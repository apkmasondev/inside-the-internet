# Changelog

All notable changes to the "Inside the Internet" project will be documented in this file.

## [1.1.0] - 2026-08-07

### Added
- Hidden default browser scrollbar (`scrollbar-width: none` & `::-webkit-scrollbar { display: none }`) for a cleaner, cinematic presentation while retaining custom gold scroll rail indicator.
- Made the "Scroll to enter" hint interactive: clicking it smoothly initiates the journey into Chapter 01.
- Added a premium "Share" button alongside "Replay" in the finale screen, featuring Web Share API support (native mobile share sheet) and a smooth gold-accented clipboard copy fallback ("COPIED").

### Fixed
- Prevented potential layout shifts by disabling default scrollbar gutter.
- Ensured safe area insets (`env(safe-area-inset-bottom)`) and responsive layout for finale action buttons on mobile screens.
