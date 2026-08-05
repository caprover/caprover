/**
 * TEST FILE: OneClickAppRouter.test.ts
 *
 * This file tests the `reportAnalyticsOnAppDeploy` function which tracks analytics
 * when one-click apps or Docker Compose templates are deployed in CapRover.
 *
 * FUNCTION OVERVIEW: reportAnalyticsOnAppDeploy(templateName, template, eventLogger)
 *
 * PURPOSE:
 * • Collects anonymous analytics about app deployments for usage insights
 * • Tracks template usage patterns and custom Docker service fields
 * • Helps identify which features are being used by the community
 *
 * TEMPLATE NAME HANDLING:
 * • TEMPLATE_ONE_CLICK - One-click app templates (reported as-is)
 * • DOCKER_COMPOSE - User-provided Docker Compose files (reported as-is)
 * • OFFICIAL_* - Official CapRover templates (reported as-is)
 * • Custom/private names - Anonymized as "UNKNOWN" for privacy
 * • Invalid inputs (null, undefined, non-string) - Defaults to "UNKNOWN"
 *
 * DOCKER SERVICE FIELD TRACKING:
 * • Only tracks unused fields for TEMPLATE_ONE_CLICK and DOCKER_COMPOSE
 * • Known Docker fields (image, ports, volumes, environment, etc.) are consumed by CapRover
 * • Custom/unknown fields are collected in an array for analytics
 * • Helps identify which Docker features users need but aren't supported
 * • Handles edge cases: null services, non-object entries, missing properties
 *
 * EVENT LOGGING:
 * • Creates a CapRoverEventType.OneClickAppDeployStarted event
 * • Event metadata includes: templateName (string) and unusedFields (string[])
 * • Uses CapRoverEventFactory to create events with proper structure
 * • Calls eventLogger.trackEvent() exactly once per deployment
 *
 * ERROR HANDLING:
 * • Robust handling of malformed inputs (null, undefined, wrong types)
 * • Graceful degradation - never throws errors, always logs something
 * • Array deduplication for repeated custom field names across services
 * • Safe iteration over potentially corrupted service arrays
 */

// Jest hoists this mock before the imports
jest.mock('../src/user/events/ICapRoverEvent', () => ({
    CapRoverEventFactory: {
        create: jest.fn().mockImplementation((type: any, data: any) => ({
            eventType: type,
            eventMetadata: data,
            timestamp: Date.now(),
        })),
    },
    CapRoverEventType: {
        OneClickAppDeployStarted: 'OneClickAppDeployStarted',
    },
}))

import { reportAnalyticsOnAppDeploy } from '../src/routes/user/oneclick/OneClickAppRouter'
import { EventLogger } from '../src/user/events/EventLogger'
import {
    CapRoverEventFactory,
    CapRoverEventType,
    ICapRoverEvent,
} from '../src/user/events/ICapRoverEvent'

describe('reportAnalyticsOnAppDeploy', () => {
    let mockEventLogger: EventLogger
    let trackedEvents: ICapRoverEvent[]

    beforeEach(() => {
        trackedEvents = []

        // Create a proper mock that satisfies EventLogger interface
        mockEventLogger = {
            trackEvent: jest.fn((event: ICapRoverEvent) => {
                trackedEvents.push(event)
            }),
        } as any as EventLogger

        // Reset the factory mock
        ;(CapRoverEventFactory.create as jest.Mock).mockClear()
    })

    describe('Template name handling', () => {
        test('should report TEMPLATE_ONE_CLICK template name as-is', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = { services: [] }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            expect(mockEventLogger.trackEvent).toHaveBeenCalledTimes(1)
            expect(trackedEvents[0].eventMetadata.templateName).toBe(
                'TEMPLATE_ONE_CLICK'
            )
        })

        test('should report DOCKER_COMPOSE template name as-is', () => {
            const templateName = 'DOCKER_COMPOSE'
            const template = { services: [] }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            expect(mockEventLogger.trackEvent).toHaveBeenCalledTimes(1)
            expect(trackedEvents[0].eventMetadata.templateName).toBe(
                'DOCKER_COMPOSE'
            )
        })

        test('should report OFFICIAL_ prefixed template names as-is', () => {
            const templateName = 'OFFICIAL_NGINX'
            const template = { services: [] }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            expect(mockEventLogger.trackEvent).toHaveBeenCalledTimes(1)
            expect(trackedEvents[0].eventMetadata.templateName).toBe(
                'OFFICIAL_NGINX'
            )
        })

        test('should report private/custom template names as UNKNOWN', () => {
            const templateName = 'my-private-template'
            const template = { services: [] }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            expect(mockEventLogger.trackEvent).toHaveBeenCalledTimes(1)
            expect(trackedEvents[0].eventMetadata.templateName).toBe('UNKNOWN')
        })

        test('should handle null templateName', () => {
            const templateName = null
            const template = { services: [] }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            expect(mockEventLogger.trackEvent).toHaveBeenCalledTimes(1)
            expect(trackedEvents[0].eventMetadata.templateName).toBe('UNKNOWN')
        })

        test('should handle undefined templateName', () => {
            const templateName = undefined
            const template = { services: [] }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            expect(mockEventLogger.trackEvent).toHaveBeenCalledTimes(1)
            expect(trackedEvents[0].eventMetadata.templateName).toBe('UNKNOWN')
        })
    })

    describe('Docker service field tracking', () => {
        test('should not track unused fields for non-Docker templates', () => {
            const templateName = 'SOME_OTHER_TEMPLATE'
            const template = {
                services: [
                    {
                        image: 'nginx:latest',
                        custom_field: 'value',
                        another_field: 'value2',
                    },
                ],
            }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            expect(trackedEvents[0].eventMetadata.unusedFields).toEqual([])
        })

        test('should track unused fields for TEMPLATE_ONE_CLICK', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = {
                services: [
                    {
                        image: 'nginx:latest',
                        environment: { VAR: 'value' },
                        custom_field: 'value',
                        another_field: 'value2',
                    },
                ],
            }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            const unusedFields = trackedEvents[0].eventMetadata.unusedFields
            expect(unusedFields).toEqual(['custom_field', 'another_field'])
        })

        test('should track unused fields for DOCKER_COMPOSE', () => {
            const templateName = 'DOCKER_COMPOSE'
            const template = {
                services: [
                    {
                        image: 'postgres:latest',
                        volumes: ['/data:/var/lib/postgresql/data'],
                        restart: 'always',
                        networks: ['backend'],
                    },
                ],
            }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            const unusedFields = trackedEvents[0].eventMetadata.unusedFields
            expect(unusedFields).toEqual(['restart', 'networks'])
        })

        test('should not track known Docker service fields', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = {
                services: [
                    {
                        image: 'nginx:latest',
                        environment: { VAR: 'value' },
                        ports: ['80:80'],
                        volumes: ['/data:/data'],
                        depends_on: ['db'],
                        hostname: 'web',
                        command: 'nginx -g "daemon off;"',
                        cap_add: ['SYS_ADMIN'],
                    },
                ],
            }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            const unusedFields = trackedEvents[0].eventMetadata.unusedFields
            expect(unusedFields).toEqual([])
        })

        test('should handle multiple services with mixed fields', () => {
            const templateName = 'DOCKER_COMPOSE'
            const template = {
                services: [
                    {
                        image: 'nginx:latest',
                        ports: ['80:80'],
                        custom_field1: 'value1',
                    },
                    {
                        image: 'postgres:latest',
                        environment: { POSTGRES_DB: 'mydb' },
                        custom_field2: 'value2',
                        another_custom: 'value3',
                    },
                ],
            }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            const unusedFields = trackedEvents[0].eventMetadata.unusedFields
            expect(unusedFields).toEqual([
                'custom_field1',
                'custom_field2',
                'another_custom',
            ])
        })

        test('should handle services with no custom fields', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = {
                services: [
                    {
                        image: 'nginx:latest',
                        ports: ['80:80'],
                    },
                ],
            }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            const unusedFields = trackedEvents[0].eventMetadata.unusedFields
            expect(unusedFields).toEqual([])
        })

        test('should handle empty services array', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = { services: [] }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            const unusedFields = trackedEvents[0].eventMetadata.unusedFields
            expect(unusedFields).toEqual([])
        })

        test('should handle template without services property', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = { other_property: 'value' }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            const unusedFields = trackedEvents[0].eventMetadata.unusedFields
            expect(unusedFields).toEqual([])
        })

        test('should handle null template', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = null

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            const unusedFields = trackedEvents[0].eventMetadata.unusedFields
            expect(unusedFields).toEqual([])
        })

        test('should handle undefined template', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = undefined

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            const unusedFields = trackedEvents[0].eventMetadata.unusedFields
            expect(unusedFields).toEqual([])
        })
    })

    describe('Event logging', () => {
        test('should call eventLogger.trackEvent exactly once', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = { services: [] }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            expect(mockEventLogger.trackEvent).toHaveBeenCalledTimes(1)
        })

        test('should create event with correct type', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = { services: [] }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            expect(trackedEvents[0].eventType).toBe(
                CapRoverEventType.OneClickAppDeployStarted
            )
        })

        test('should create event with correct metadata structure', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = {
                services: [
                    {
                        image: 'nginx:latest',
                        custom_field: 'value',
                    },
                ],
            }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            const eventMetadata = trackedEvents[0].eventMetadata
            expect(eventMetadata).toHaveProperty('unusedFields')
            expect(eventMetadata).toHaveProperty('templateName')
            expect(Array.isArray(eventMetadata.unusedFields)).toBe(true)
            expect(typeof eventMetadata.templateName).toBe('string')
        })
    })

    describe('Edge cases and error handling', () => {
        test('should handle services with null/undefined service objects', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = {
                services: [null, undefined, { image: 'nginx:latest' }],
            }

            expect(() => {
                reportAnalyticsOnAppDeploy(
                    templateName,
                    template,
                    mockEventLogger
                )
            }).not.toThrow()

            expect(mockEventLogger.trackEvent).toHaveBeenCalledTimes(1)
        })

        test('should handle services array containing non-object values', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = {
                services: ['string', 123, true, { image: 'nginx:latest' }],
            }

            expect(() => {
                reportAnalyticsOnAppDeploy(
                    templateName,
                    template,
                    mockEventLogger
                )
            }).not.toThrow()

            expect(mockEventLogger.trackEvent).toHaveBeenCalledTimes(1)
        })

        test('should handle template name that is not a string', () => {
            const templateName = 123
            const template = { services: [] }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            expect(trackedEvents[0].eventMetadata.templateName).toBe('UNKNOWN')
        })

        test('should handle empty string template name', () => {
            const templateName = ''
            const template = { services: [] }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            expect(trackedEvents[0].eventMetadata.templateName).toBe('UNKNOWN')
        })

        test('should preserve array uniqueness for duplicate unused fields', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = {
                services: [
                    {
                        image: 'nginx:latest',
                        custom_field: 'value1',
                    },
                    {
                        image: 'postgres:latest',
                        custom_field: 'value2', // Same field name, different value
                    },
                ],
            }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            const unusedFields = trackedEvents[0].eventMetadata.unusedFields
            expect(unusedFields).toEqual(['custom_field'])
            expect(unusedFields.length).toBe(1)
        })
    })

    describe('Integration with CapRoverEventFactory', () => {
        test('should use CapRoverEventFactory.create method', () => {
            const templateName = 'TEMPLATE_ONE_CLICK'
            const template = { services: [] }

            reportAnalyticsOnAppDeploy(templateName, template, mockEventLogger)

            expect(CapRoverEventFactory.create).toHaveBeenCalledWith(
                CapRoverEventType.OneClickAppDeployStarted,
                {
                    unusedFields: [],
                    templateName: 'TEMPLATE_ONE_CLICK',
                }
            )
        })
    })
})
