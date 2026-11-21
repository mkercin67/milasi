# M7c-2c: Hairpins (crescendo, diminuendo)

Status: IMPLEMENTED v1 (found by the Barge BWV 1030 acceptance entry, measure 7: a crescendo and a diminuendo
under one bar). Part of `docs/design/m7c-plan.md`.

## Model (no schema bump)
`Staff.hairpins?: { id, type: 'crescendo' | 'diminuendo', startEventId, endEventId }[]`. Like slurs, a hairpin
belongs to the staff and points at events, so copy-paste does not carry it and deleting an event or measure
removes the hairpins that touch it (`deleteEvent`, `deleteRange`, `transposeRange`, `deleteMeasure`).

## Entry
Select a range of at least two notes, press "Cresc." or "Dim.". The same button again removes it; the other
button switches the type. The hairpin runs from the first to the last selected event.

## Drawing
Below the staff on the dynamics line (staff top + 6 sp, lower if low notes reach down). Two thin filled strips,
0 to 1.2 sp opening (reversed for a diminuendo), from the left edge of the first notehead to the right edge of
the last. A hairpin over a system break is split in two and the opening continues across the break. It is
returned in the slur item shape, so the existing overlay drawing and SVG export handle it.

## Validation
`hairpin-missing-event`, `hairpin-invalid-order`, `invalid-hairpin` (all errors).

## Not in this step
Keyboard shortcuts, hairpins on a selection inside one event, manual length or vertical offset, placement above
the staff, a hairpin that ends on a dynamic marking (end of the line is then shortened), clearing with "clear
notations", copy-paste, playback (M11).
