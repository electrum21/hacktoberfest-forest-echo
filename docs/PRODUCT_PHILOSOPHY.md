# Product philosophy: silence is a feature

Forest Echo should never become an AI podcast about the outdoors.

The user already has a rich audio source: wind, birds, insects, water, footsteps, distant traffic, leaves and other people. AI is useful only when the listener encounters a sound they want help understanding.

## Design rules

1. **Silent by default.** No proactive narration in the MVP.
2. **Pull, don't push.** The user initiates every AI interaction.
3. **Capture briefly.** A hold records at most five seconds.
4. **Explain, don't replay.** The app does not play the captured environmental sample back through the device.
5. **One idea per response.** Gemma aims for 10–25 spoken words and never exceeds 35.
6. **No spoken gamification.** Badges and "new to your life list" can be shown after the interaction, but they do not interrupt the soundscape.
7. **Return to silence.** When the field note ends, the app stops talking.
8. **The screen is temporary.** The user should be able to put the phone away immediately after releasing the button. Pocket mode enforces this: once the note ends, the screen goes black.
9. **Invite, don't nudge.** Reasons to go outside appear only when the user opens the app, on screen, in a calm voice. Never a push, a sound, or a spoken prompt.

## Success metric

The strongest session is not the one with the most AI interactions. It is the one where Forest Echo helps the user notice something interesting and then disappears back into the background.

## Encouraging people outside, quietly

Forest Echo does not try to win attention. It tries to make a walk a little more tempting for someone who opens the app anyway. The rules:

- **Pull, never push.** No push notifications, no sounds, no vibration, nothing spoken. Invitations are text on the home screen that the user sees only by opening the app.
- **Reasons, not pressure.** "Best listening today: 6:12 to 8:40 AM" and "This week, listen for: Northern Cardinal" give a reason to go. There are no countdowns, no "you're falling behind", no lost-streak messages.
- **Forgiving counts.** The seven-dot row shows days outdoors, nothing more. A zero week gets "Even ten minutes outside counts", not a reprimand.
- **The user owns any reminder.** The app can hand over a weekly calendar event as a file. Whether and how it ever alerts is up to the user's own calendar app, which they can edit or delete.
- **Private by construction.** Sunrise is computed on the device. Coordinates are never stored; only the opt-in preference is remembered, so location can be restored quietly on the next visit.
- **Honest labelling.** In demo mode the weekly target is marked as coming from a demo list.

## Facts the app can stand behind

A small open model is good at phrasing and bad at remembering. So the species claim comes from BirdNET, and the natural-history detail comes from a curated file, one short fact or one "where to look" cue per note. Gemma only words it, and the verification step checks the result. If the app has no vetted detail for a bird, it says only the bird's name rather than guessing.

