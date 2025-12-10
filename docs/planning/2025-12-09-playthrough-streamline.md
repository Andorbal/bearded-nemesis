# Streamline the playthrough workflow

I feel like we've spent a lot of time trying to get the OCR working well but it's just not there yet.  I would like the app to be useful sooner rather than later so I would like to change course for a bit.

## Remove OCR

I want to remove the OCR from the workflow for the time being.  I still want to upload images of the end screen for each song so that I'll have a record and so that if/when I get OCR back into the app, I'll be able to run it on all the images that I've got stored, even if I have to do it one by one.  We should remove the OCR from the workflow completely and document what we currently have as well as the last commit that included the OCR components.  We can leave the OCR project in place but we should remove it from the docker compose file.

## Manually enter stats

The song screen for a playthrough should be modified so that when a song is finished, the stats can be quickly entered and it should be optimized for mobile devices.

The screen currently shows some details about a song and has an image upload/take picture button.  I would like to add a form above the button that has the stats laid out in the order they appear on the screen with the appropriate type of editor:

### Results
- *Completion percent* - numbers only in the editor, show a % sign in the UI after the field
- *Skill level* - drop down with possible skill levels, with the value set to what was selected in the previous song, or else the player's selection when starting the playthrough
- *Score* - Numbers only
- *Stars* - Star selector, with 1 to 5 starts being selectable.  There should be a toggle for gold stars if 5 stars is chosen

### Performance
- *Longest Streak* - Numbers only
- *Notes Hit* - Numbers only
- *Notes missed* - Numbers only
- *Avg. Multiplier* - Numbers only

It would be great if there was a "next" button or something in each control that would move to the next to make entry as quick as possible.  When a field loses focus, it should save immediately so that all players can store their own stats in their own time and not have to wait for the "next song" button or the "finish" button to be pressed.

## UI Review

Since we're heavily working in the song details view, I would like to ensure that it has a good amount of tests around it and I want to start breaking it up into smaller, more reusable components.  We should build Storybook stories for all of the reusable components we build along with the bigger composite controls that get created.  We'll want to come up with a good control hierarchy before starting this.

## Testing

I want to make sure that we have a good set of tests around the playthrough song components and that they all pass at each stage of this development cycle.  We **cannot** consider anything done until all associated tests pass.