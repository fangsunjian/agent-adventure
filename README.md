# Gemini Adventure

**Last Updated: 2024-08-03**

A dynamic text adventure game platform powered by AI. This application uses Google's Gemini for narrative generation and Imagen for illustrations, creating a unique and immersive storytelling experience.

Originally a single-player game, Gemini Adventure is evolving into a community-driven platform where users can create their own rich, interactive stories, share them with others, and play adventures crafted by the community.

## Core Features

-   **Dynamic Storytelling**: The AI generates a rich story in real-time based on player choices.
-   **AI-Generated Visuals**: Each scene can be accompanied by a beautiful, AI-generated image.
-   **Save/Load Progress**: The platform now automatically saves your progress for each story you play.
-   **Flexible AI Backend**: Use Google Gemini by default or switch to a custom OpenAI-compatible API endpoint.
-   **Multi-language Support**: The interface is available in both English and Chinese.

## Latest Changes

### UI/UX Refinements

This update focuses on polishing the user interface and improving the overall user experience for a more immersive and professional feel.

-   **Dedicated Game View**: The game screen is no longer part of the main navigation. It now launches as a dedicated, full-screen experience when you start a story, removing distractions and focusing the player on the adventure.
-   **Graceful Image Loading**:
    -   Story cards now display a placeholder while loading cover images. If an image URL is invalid, a "no image" icon is shown, preventing broken UI elements.
    -   The game's background image now loads gracefully, only appearing once ready and falling back to a solid color if it fails to load.
-   **Consistent Aesthetics**: Confirmation dialogs have been restyled with a semi-transparent "glassmorphism" effect, matching the look and feel of the game screen for a cohesive design.
-   **Optimized Layout**: The "What do you do next?" prompt on the game screen has been relocated to a more subtle position, freeing up valuable vertical space for the story narrative.

### Integrated Gameplay and Progress Saving

This update fully integrates the creation and gameplay experiences, making the platform feel cohesive and alive.

-   **Click-to-Play**: Clicking a story card on the "Home" or "Explore" pages now immediately starts the adventure in a redesigned game interface.
-   **Automatic Game Saves**: Your progress in each story (history, summaries, turn number) is automatically saved to your browser. The "Profile" page now features a "Recently Played" section where you can continue your adventures or delete saved progress.
-   **Dynamic Game Environment**: The game screen now uses the story's cover image as an immersive background, and all game content (background, characters, opening scene) is loaded directly from the selected story's data. The old generic start screen has been removed.
-   **Refined UI**:
    -   Global settings and the theme toggle have been moved to the "Profile" page for a cleaner in-game experience.
    -   Story creators can now specify a custom cover image URL for their creations.
-   **Enriched Content**: The initial sample stories have been fleshed out with detailed library cards, settings, and opening monologues to showcase the platform's capabilities.