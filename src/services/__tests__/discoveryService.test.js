
import { DiscoveryService } from '../discoveryService';

// Mock DuckDB connection
const mockConn = {
    query: jest.fn()
};

describe('DiscoveryService', () => {
    let service;

    beforeEach(() => {
        service = new DiscoveryService(mockConn);
        jest.clearAllMocks();
    });

    test('should detect Person entity from column name and values', () => {
        const columnDiscovery = {
            name: 'Employee Name',
            type: 'VARCHAR',
            isText: true,
            topValues: [
                { value: 'John Doe', frequency: 10 },
                { value: 'Jane Smith', frequency: 5 }
            ],
            cardinality: 0.8
        };

        const entityType = service.detectEntityType(columnDiscovery);
        expect(entityType).toBe('person');
    });

    test('should detect Location entity from column name', () => {
        const columnDiscovery = {
            name: 'Shipping City',
            type: 'VARCHAR',
            isText: true,
            topValues: [{ value: 'New York', frequency: 100 }],
            cardinality: 0.1
        };

        const entityType = service.detectEntityType(columnDiscovery);
        expect(entityType).toBe('location');
    });

    test('should search for values across columns', () => {
        service.metadataCache = {
            columns: {
                'Employee': {
                    topValues: [{ value: 'Joe', frequency: 1 }],
                    name: 'Employee',
                    isText: true
                },
                'City': {
                    topValues: [{ value: 'New York', frequency: 1 }],
                    name: 'City',
                    isText: true
                }
            },
            entities: {
                'person': ['Employee'],
                'location': ['City']
            }
        };

        const results = service.searchValue('Joe');
        expect(results).toHaveLength(1);
        expect(results[0].column).toBe('Employee');
        expect(results[0].selected).toBeUndefined(); // internal use
    });

    test('should return multiple matches for ambiguous values', () => {
        service.metadataCache = {
            columns: {
                'Employee': {
                    topValues: [{ value: 'Jordan', frequency: 1 }],
                    name: 'Employee',
                    isText: true
                },
                'City': {
                    topValues: [{ value: 'Jordan', frequency: 1 }], // Like the country/city
                    name: 'City',
                    isText: true
                }
            },
            entities: {
                'person': ['Employee'],
                'location': ['City']
            }
        };

        const results = service.searchValue('Jordan');
        expect(results).toHaveLength(2);
    });
});
