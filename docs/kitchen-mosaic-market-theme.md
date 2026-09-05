# Mosaic Market — expressive kitchen theme

Mosaic Market is the more colorful direction for Prism. It takes its cues
from glazed kitchen tile, terracotta, saffron, olive, sky, cobalt, and plum
against a warm cream foundation. The palette is broader by design: color is
used to establish hierarchy and widget families, not sprinkled randomly as
decoration.

The daytime canvas stays light enough for a wall display, but the cards no
longer collapse into one neutral field. The evening version becomes deep
blue-teal with warm cream type and jewel-like accents, keeping the identity
visible without turning the wall into a bright monitor.

Mosaic Market is the default. Hearth & Linen and Cedar & Clay remain available
in Appearance for comparison.

## Palette

### Core roles

| Role                    | Day       | Night     | Intended use                                                      |
| ----------------------- | --------- | --------- | ----------------------------------------------------------------- |
| Main background / cream | `#EBDFD1` | `#111F22` | Page canvas and visible gaps between cards.                       |
| Elevated/card surface   | `#FFFAF0` | `#213236` | Default widgets and primary information panels.                   |
| Secondary surface       | `#EEDDC9` | `#324549` | Toolbars, filters, grouped controls, and quiet containers.        |
| Popover surface         | `#FAF4EB` | `#273C3F` | Menus, dialogs, and transient overlays.                           |
| Primary text            | `#1D3039` | `#FFF1D6` | Clock, titles, event names, and important values.                 |
| Secondary / muted text  | `#475A66` | `#E0CCA9` | Dates, locations, metadata, and supporting labels.                |
| Border / divider        | `#957B5F` | `#74989A` | Card edges and structural dividers.                               |
| Input boundary          | `#846C52` | `#7EA4A5` | Form controls and focus-adjacent boundaries.                      |
| Primary accent / teal   | `#27726E` | `#76CBC3` | Active navigation, primary action, and focus ring.                |
| Saffron accent          | `#F5D48F` | `#795E20` | Today markers, meal cues, and deliberate secondary emphasis.      |
| Success / positive      | `#267E56` | `#6DD5A2` | Completed, healthy, connected, and ready states.                  |
| Warning / attention     | `#A35914` | `#F0BF6A` | Pending approval, moderate risk, and look-soon states.            |
| Error / urgent          | `#B1362B` | `#F29C92` | Overdue, failed, severe, and action-now states.                   |
| Informational           | `#2A7592` | `#81CBE4` | Weather, travel, sync, and neutral system information.            |
| Disabled surface        | `#DED5C9` | `#435556` | Inactive controls and unavailable content.                        |
| Disabled text           | `#67757E` | `#B8AB94` | Labels on disabled controls; never use for essential information. |

### Widget family surfaces

Color neighborhoods make the dashboard easier to scan from across a room:

| Family                     | Day       | Night     |
| -------------------------- | --------- | --------- |
| Calendar — cream / saffron | `#FFFAF0` | `#403326` |
| Planning — olive / leaf    | `#E4F1E0` | `#264030` |
| Family — coral / plum      | `#FEF8F6` | `#47242A` |
| Information — sky / teal   | `#F4F9FB` | `#28434D` |
| Today marker               | `#F6DB98` | `#695016` |

The family surfaces are intentionally distinct, but their text and borders
share the same system so the dashboard still reads as one object.

### Weather ramp

Weather color follows a simple visual story rather than a generic rainbow:

- Cold: cobalt and sky blue
- Cool: leaf green
- Mild: saffron
- Warm: orange clay
- Hot: coral

The ramp is reserved for temperature and precipitation visualization. It does
not replace semantic success, warning, error, or info colors.

## CSS variables

Prism uses space-separated HSL values for its theme contract.

```css
:root[data-color-theme='mosaic'] {
  --background: 33 39% 87%;
  --foreground: 201 32% 17%;
  --card: 42 100% 97%;
  --card-foreground: 201 32% 17%;
  --popover: 35 60% 95%;
  --popover-foreground: 201 32% 17%;
  --primary: 177 49% 30%;
  --primary-foreground: 40 100% 97%;
  --secondary: 33 52% 86%;
  --secondary-foreground: 201 32% 17%;
  --muted: 35 50% 92%;
  --muted-foreground: 204 18% 34%;
  --accent: 41 83% 76%;
  --accent-foreground: 205 32% 18%;
  --destructive: 5 61% 43%;
  --destructive-foreground: 40 100% 97%;
  --border: 31 22% 48%;
  --input: 31 23% 42%;
  --ring: 177 49% 30%;

  --status-success: 153 54% 32%;
  --status-warning: 29 78% 36%;
  --status-error: 5 65% 43%;
  --status-info: 197 55% 37%;
  --disabled: 35 25% 83%;
  --disabled-foreground: 204 10% 45%;

  --shadow-color: 201 32% 17%;
  --shadow-card:
    0 10px 24px hsl(var(--shadow-color) / 0.12), 0 1px 2px hsl(var(--shadow-color) / 0.18);
  --shadow-card-hover:
    0 14px 30px hsl(var(--shadow-color) / 0.18), 0 2px 4px hsl(var(--shadow-color) / 0.18);
}

:root.dark[data-color-theme='mosaic'] {
  --background: 190 34% 10%;
  --foreground: 39 100% 92%;
  --card: 190 24% 17%;
  --card-foreground: 39 100% 92%;
  --popover: 188 24% 20%;
  --popover-foreground: 39 100% 92%;
  --primary: 174 45% 63%;
  --primary-foreground: 190 30% 12%;
  --secondary: 190 19% 24%;
  --secondary-foreground: 39 100% 92%;
  --muted: 188 20% 22%;
  --muted-foreground: 38 47% 77%;
  --accent: 42 58% 30%;
  --accent-foreground: 39 100% 92%;
  --destructive: 6 78% 76%;
  --destructive-foreground: 6 38% 14%;
  --border: 183 16% 53%;
  --input: 182 18% 57%;
  --ring: 174 55% 78%;

  --status-success: 151 55% 63%;
  --status-warning: 38 82% 68%;
  --status-error: 6 78% 70%;
  --status-info: 195 65% 70%;
  --disabled: 185 13% 30%;
  --disabled-foreground: 39 20% 65%;

  --shadow-color: 190 34% 6%;
  --shadow-card:
    0 10px 28px hsl(var(--shadow-color) / 0.38), 0 1px 3px hsl(var(--shadow-color) / 0.44);
  --shadow-card-hover:
    0 16px 36px hsl(var(--shadow-color) / 0.46), 0 2px 5px hsl(var(--shadow-color) / 0.5);
}
```

## Application rules

- Let widget family surface color do real organizational work: cream for
  dates, olive for planning, coral/plum for family content, and sky for
  information.
- Use teal for the active destination or primary action. Keep it visible and
  confident, but do not fill every card with it.
- Use saffron for “today” and timely emphasis. It should be easy to spot from
  across the room without implying danger.
- Use the weather ramp only in the chart, temperature marks, and precipitation
  cues. Do not let weather colors leak into unrelated status states.
- Status cards use a colored rule or icon plus a text label. Never rely on hue
  alone for a critical condition.
- Keep error and warning saturated enough to read as intentional accents, but
  reserve them for real attention states.
- Use Sunset brightness mode. A 30–60 minute negative offset is a useful
  starting point when warm kitchen lighting comes on before sunset.

## Component mapping

| Component                 | Surface                 | Treatment                                                               |
| ------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| Clock / date              | Information / sky       | Large ink time; teal greeting or rule; date in muted warm text.         |
| Weather                   | Information / sky       | Temperature ramp in the chart; info color for rain and sync metadata.   |
| Family calendar           | Calendar / saffron      | Today gets the saffron marker; event names stay ink for legibility.     |
| Upcoming events           | Calendar                | Next event gets a teal rule; later metadata remains muted but readable. |
| Reminders / tasks         | Planning / olive        | Completion uses success green plus a check; overdue uses error red.     |
| Home status               | Information             | Success, warning, and error use the semantic status roles with labels.  |
| Navigation                | Card / teal             | Active destination uses teal; hover/focus may use saffron.              |
| Alert / notification card | Relevant family surface | Use a saturated 3–4px status rule, icon, label, and readable body.      |

This is a colorful system with a clear grammar: teal acts, saffron marks
time, the four family surfaces organize, the weather ramp explains, and the
status colors communicate urgency.
