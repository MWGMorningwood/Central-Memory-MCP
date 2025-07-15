# Changelog

## [Unreleased]

### Changed
- **BREAKING**: MCP tool parameters now use object format instead of JSON strings
  - `create_entities`: `entities` parameter now takes single entity object
  - `create_relations`: `relations` parameter now takes single relation object
  - `update_entity`: `newObservations` and `metadata` parameters now take objects
  - `execute_batch_operations`: `operations` parameter now takes object with array
  - `merge_entities`: `sourceEntityNames` parameter now takes object with array
- Updated all tool descriptions to reflect object-based parameters
- Added backward compatibility for handlers to support both string and object inputs

### Fixed
- Fixed "tool parameters array type must have items" validation error
- Improved parameter validation and error handling

### Documentation
- Updated API.md with new object parameter examples
- Updated README.md with current tool usage patterns
- Added parameter format note to Quick Start section
