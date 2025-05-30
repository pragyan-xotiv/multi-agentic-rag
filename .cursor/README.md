# Project-Specific Cursor Settings

This directory contains settings specific to this project when using the Cursor editor.

## Current Settings

### Auto Update TODO.md

This rule automatically checks if the TODO.md file needs to be updated when:
- Files are edited and saved
- New files are created

The rule applies to TypeScript files in the `src` directory and SQL files in the `supabase` directory.

When such changes are detected, Cursor's AI assistant will check if any TODO items should be marked as completed, in-progress, or need other updates based on the changes.

## How It Works

After implementing a feature or making significant changes, the assistant will automatically:
1. Analyze which components were completed or modified
2. Update the TODO.md file to reflect these changes
3. Update progress tracking statistics
4. Adjust priorities and next steps

This ensures the project's TODO list stays current without requiring manual updates.

## Customization

To modify these settings, edit the `settings.json` file in this directory. 