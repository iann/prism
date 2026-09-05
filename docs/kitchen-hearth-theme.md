# Hearth & Linen — ambient kitchen theme

Hearth & Linen is a warm, low-noise visual system for a Prism dashboard that
lives on a kitchen wall. It borrows from limewashed walls, linen, deep green
cabinetry, aged brass, and muted terracotta rather than from software chrome.

The day palette uses a warm greige canvas with nearly-white linen cards. The
canvas is intentionally darker than the cards so a person can find a widget at
a glance from 6–15 feet away. The evening palette moves to deep pine and warm
charcoal, keeping text warm instead of blue-white so the display feels like a
small piece of ambient lighting rather than a bright monitor.

## Palette

### Core roles

| Role                     | Day       | Night     | Use                                                                     |
| ------------------------ | --------- | --------- | ----------------------------------------------------------------------- |
| Main background / canvas | `#DED7CA` | `#17221E` | Page canvas and gaps between widgets.                                   |
| Elevated/card surface    | `#F7F1E7` | `#222F29` | Default widget cards and primary panels.                                |
| Secondary surface        | `#ECE5D9` | `#2D3A33` | Toolbar strips, filters, grouped controls, and quiet containers.        |
| Popover surface          | `#F3EEE4` | `#27352E` | Menus, dialogs, and transient overlays.                                 |
| Primary text             | `#26352F` | `#F0E9DC` | Clock, titles, event names, and important values.                       |
| Secondary / muted text   | `#53615A` | `#C4C2B6` | Dates, locations, metadata, and supporting labels.                      |
| Border / divider         | `#7F877E` | `#738279` | Card boundaries and structural dividers; never use as body text.        |
| Input boundary           | `#6E7A71` | `#85968A` | Form controls and focus-adjacent boundaries.                            |
| Primary accent / sage    | `#335F53` | `#A8C6AE` | Active navigation, primary actions, today markers, and focus rings.     |
| Primary accent ink       | `#F7F2E7` | `#19271F` | Text/icons placed on the primary accent.                                |
| Secondary accent / clay  | `#A05B42` | `#D49A77` | Small decorative markers, birthdays, meal cues, and secondary emphasis. |
| Success / positive       | `#3F765D` | `#91C7A2` | Completed, healthy, connected, or ready states.                         |
| Warning / attention      | `#925E22` | `#DDB06F` | Pending approval, moderate risk, and “look soon” states.                |
| Error / urgent           | `#8F4235` | `#E19A8C` | Overdue, failed, severe, or action-now states.                          |
| Informational            | `#3F6874` | `#95C1CF` | Weather, travel, sync, and neutral system information.                  |
| Disabled surface         | `#D8D5CC` | `#4D5A51` | Inactive controls and unavailable content.                              |
| Disabled text            | `#7B817A` | `#9BA69C` | Labels on disabled controls; do not use for essential content.          |

### Widget family surfaces

These are low-chroma tints, not competing accent colors. They let a wall
display group information without making every card look like a separate app.

| Family                                        | Day       | Night     |
| --------------------------------------------- | --------- | --------- |
| Calendar                                      | `#F9F4EB` | `#24322C` |
| Planning — tasks, shopping, meals, chores     | `#E7EEE6` | `#29372F` |
| Family — messages, birthdays, points, wishes  | `#F4E8E0` | `#382D29` |
| Information — clock, weather, transit, travel | `#E6EFEE` | `#283840` |
| Today marker                                  | `#D6E1D3` | `#3B4B40` |

Primary and muted text are designed to stay above 4.5:1 on their intended
surfaces. Borders target roughly 3:1 for large, structural boundaries. The
warning color is deliberately dark enough to work as text in day mode; the
clay accent is for small marks and fills, not paragraphs.

## CSS tokens

Prism stores its Tailwind color tokens as space-separated HSL values. This
block is the drop-in form for the existing token system. The status and
elevation variables are included because they are useful in custom widgets as
well as the built-in components.

```css
:root[data-color-theme='hearth'] {
  --background: 39 23% 83%;
  --foreground: 156 16% 18%;
  --card: 37 50% 94%;
  --card-foreground: 156 16% 18%;
  --popover: 40 38% 92%;
  --popover-foreground: 156 16% 18%;
  --primary: 164 30% 29%;
  --primary-foreground: 41 50% 94%;
  --secondary: 38 33% 89%;
  --secondary-foreground: 156 16% 18%;
  --muted: 40 38% 92%;
  --muted-foreground: 150 8% 35%;
  --accent: 87 20% 89%;
  --accent-foreground: 155 26% 23%;
  --destructive: 9 46% 38%;
  --destructive-foreground: 23 100% 97%;
  --border: 113 4% 51%;
  --input: 135 5% 45%;
  --ring: 164 30% 29%;

  --status-success: 153 30% 35%;
  --status-warning: 32 62% 35%;
  --status-error: 9 46% 38%;
  --status-info: 194 30% 35%;
  --disabled: 45 13% 82%;
  --disabled-foreground: 111 3% 49%;

  --shadow-color: 156 16% 18%;
  --shadow-card:
    0 10px 24px hsl(var(--shadow-color) / 0.1), 0 1px 2px hsl(var(--shadow-color) / 0.16);
  --shadow-card-hover:
    0 14px 30px hsl(var(--shadow-color) / 0.15), 0 2px 4px hsl(var(--shadow-color) / 0.16);
}

:root.dark[data-color-theme='hearth'] {
  --background: 158 19% 11%;
  --foreground: 39 40% 90%;
  --card: 152 16% 16%;
  --card-foreground: 39 40% 90%;
  --popover: 151 16% 18%;
  --popover-foreground: 39 40% 90%;
  --primary: 132 21% 72%;
  --primary-foreground: 146 22% 13%;
  --secondary: 148 13% 20%;
  --secondary-foreground: 39 40% 90%;
  --muted: 149 11% 22%;
  --muted-foreground: 51 11% 74%;
  --accent: 145 14% 24%;
  --accent-foreground: 39 40% 90%;
  --destructive: 10 59% 72%;
  --destructive-foreground: 10 38% 13%;
  --border: 144 6% 48%;
  --input: 138 7% 55%;
  --ring: 132 21% 72%;

  --status-success: 139 33% 67%;
  --status-warning: 35 62% 65%;
  --status-error: 10 59% 72%;
  --status-info: 194 38% 70%;
  --disabled: 138 8% 33%;
  --disabled-foreground: 125 6% 63%;

  --shadow-color: 158 19% 6%;
  --shadow-card:
    0 10px 28px hsl(var(--shadow-color) / 0.34), 0 1px 3px hsl(var(--shadow-color) / 0.4);
  --shadow-card-hover:
    0 16px 36px hsl(var(--shadow-color) / 0.4), 0 2px 5px hsl(var(--shadow-color) / 0.44);
}

/* Useful in custom components. */
.hearth-card {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border: 1px solid hsl(var(--border));
  box-shadow: var(--shadow-card);
}

.hearth-status-success {
  color: hsl(var(--status-success));
}
.hearth-status-warning {
  color: hsl(var(--status-warning));
}
.hearth-status-error {
  color: hsl(var(--status-error));
}
.hearth-status-info {
  color: hsl(var(--status-info));
}
```

Use `bg-status-warning/10`, `text-status-warning`, and their success/error/
info equivalents for stateful UI. The status utilities are intentionally
semantic so a component does not need to know the exact hue of the selected
palette.

## Application rules

- Keep the canvas visible between cards. A 1px border plus a soft shadow is
  enough separation; do not add thick outlines to every panel.
- Use the primary sage for one active action or focus target at a time. It is
  not a general-purpose decoration.
- Use clay for a small secondary cue (a date dot, meal marker, or family
  accent). Avoid using it for navigation or large filled panels.
- Status treatment should be a small tinted surface, a readable label, and an
  icon or shape. Never communicate urgent state with color alone.
- Reserve the error role for action-now conditions. Warnings should be visible
  but should not make an ordinary day feel like an alarm panel.
- Keep disabled content at least structurally present but reduce contrast and
  opacity; do not hide context that explains why something is unavailable.
- Use `Sunset` brightness mode on a wall display. A 30–60 minute negative
  sunset offset is a reasonable starting point in a room with warm evening
  lights; tune it to the actual room rather than the clock.

## Component mapping

| Component                 | Surface                  | Primary treatment                                                          | Supporting treatment                                                                                         |
| ------------------------- | ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Clock / date              | Information surface      | Large time in primary text; optional greeting in primary accent.           | Date in muted text; no seconds unless actively useful.                                                       |
| Weather                   | Information surface      | Current temperature and condition icon in primary text/accent.             | Weather ramp for temperature; `status-info` for rain/sync; `status-warning` for air-quality risk.            |
| Family calendar           | Calendar surface         | Event names use primary text; today gets the sage ring/today marker.       | Calendar-specific event colors stay distinct but muted; dates and locations use muted text.                  |
| Upcoming events           | Calendar or card surface | Next event gets a slightly stronger text weight and a thin primary rule.   | Later events use muted metadata, never lower-contrast gray-on-gray.                                          |
| Reminders / tasks         | Planning surface         | Task title in primary text; completion uses a check plus `status-success`. | Due dates stay muted until overdue, then use `status-error` and an alert icon.                               |
| Home status               | Information surface      | Healthy/connected uses `status-success` with a label such as “All clear.”  | Unknown uses `status-info`; attention uses `status-warning`; pair every dot with text.                       |
| Navigation                | Card surface             | Active destination uses the primary sage fill and primary-foreground ink.  | Inactive links use muted text; hover uses the soft accent surface.                                           |
| Alert / notification card | Relevant family surface  | Use a 3–4px status rule, icon, short label, and readable status color.     | Keep the body on the normal card surface; reserve tinted backgrounds for the alert header or compact banner. |

The result is a display that can be understood quickly when someone walks into
the kitchen, but that settles back into the room when nobody is looking at it.
