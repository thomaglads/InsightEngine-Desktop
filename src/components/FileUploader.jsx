import React, { useState } from 'react';
import { Folder, Loader2 } from 'lucide-react';
import { FileUploadValidator, CSVAnalyzer } from '../utils/fileValidator.js';
import { CONFIG } from '../config/constants.js';

export const FileUploader = ({ onFileUpload, loading, disabled }) => {
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ stage: 'idle', percent: 0 });

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    setValidationError('');
    setUploadProgress({ stage: 'reading', percent: 5 });

    // Validate file
    const validation = FileUploadValidator.validateFile(file);
    if (!validation.isValid) {
      setValidationError(validation.errors.join('. '));
      setUploadProgress({ stage: 'idle', percent: 0 });
      return;
    }

    // Validate content
    try {
      setUploadProgress({ stage: 'reading', percent: 20 });
      // Read only the first 50KB for validation
      const { text: content } = await FileUploadValidator.readHead(file);

      setUploadProgress({ stage: 'analyzing', percent: 50 });
      const contentValidation = FileUploadValidator.validateCSVContent(content);

      if (!contentValidation.isValid) {
        setValidationError(contentValidation.errors.join('. '));
        setUploadProgress({ stage: 'idle', percent: 0 });
        return;
      }

      // Show warnings if any
      if (contentValidation.warnings.length > 0) {
        console.warn('File validation warnings:', contentValidation.warnings);
      }

      // Analyze content for metadata
      setUploadProgress({ stage: 'analyzing', percent: 80 });
      // Pass file size for memory estimation
      const analysis = CSVAnalyzer.analyze(content, file.size);

      setUploadProgress({ stage: 'complete', percent: 100 });
      // Pass null for full content to enforce streaming
      await onFileUpload(file, null, analysis);
      setUploadProgress({ stage: 'idle', percent: 0 });

    } catch (error) {
      setValidationError(`Failed to read file: ${error.message}`);
      setUploadProgress({ stage: 'idle', percent: 0 });
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const isProcessing = loading || uploadProgress.stage !== 'idle';

  return (
    <div className="p-6">
      <label className={`group flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all ${dragActive
        ? 'border-yellow-400 bg-yellow-900/20'
        : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50'
        } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}>
        <input
          type="file"
          onChange={handleFileChange}
          accept=".csv"
          className="hidden"
          disabled={disabled || isProcessing}
        />

        {isProcessing ? (
          <Loader2
            size={48}
            className="mb-3 text-yellow-500 animate-spin"
          />
        ) : (
          <Folder
            size={48}
            className={`mb-3 transition-colors ${dragActive ? 'text-yellow-400' : 'text-yellow-500 group-hover:text-yellow-400'
              }`}
            fill="currentColor"
            fillOpacity={0.2}
          />
        )}

        <span className="text-sm font-bold text-zinc-400 group-hover:text-white uppercase tracking-wider">
          {uploadProgress.stage === 'reading' ? `Reading File (${uploadProgress.percent}%)` :
            uploadProgress.stage === 'analyzing' ? `Analyzing Data (${uploadProgress.percent}%)` :
              loading ? 'Ingesting into Database...' : 'Upload Data'}
        </span>

        <span className="text-xs text-zinc-600 mt-2">
          Max size: {FileUploadValidator.formatFileSize(CONFIG.SECURITY.MAX_FILE_SIZE)}
        </span>
      </label>

      {validationError && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm font-medium">{validationError}</p>
        </div>
      )}
    </div>
  );
};