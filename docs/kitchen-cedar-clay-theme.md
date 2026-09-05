# Cedar & Clay — ambient kitchen theme

Cedar & Clay is a second, deliberately warmer direction for Prism. It is
based on plaster, walnut, olive leaves, aged brass, and fired clay: materials
that already belong beside wood, stone, stainless steel, and warm kitchen
lighting.

The main change from Hearth & Linen is temperature and weight. The light mode
is not a pale green dashboard; it is a quiet breakfast-room palette with
espresso text and tactile brown structure. The night mode becomes a low,
candlelit espresso rather than a blue-black computer interface. Cedar & Clay
is now the default, while Hearth & Linen remains available in Appearance for
comparison.

## Palette

### Core roles

| Role                      | Day       | Night     | Intended use                                                      |
| ------------------------- | --------- | --------- | ----------------------------------------------------------------- |
| Main background / plaster | `#E2D7CB` | `#1E1915` | Page canvas and visible gaps between cards.                       |
| Elevated/card surface     | `#F8F3EC` | `#2D261F` | Default widgets and primary information panels.                   |
| Secondary surface         | `#EEE3D7` | `#453A30` | Toolbars, filters, grouped controls, and quiet containers.        |
| Popover surface           | `#F4ECE1` | `#382D24` | Menus, dialogs, and transient overlays.                           |
| Primary text              | `#34261D` | `#F1EADF` | Clock, titles, event names, and important values.                 |
| Secondary / muted text    | `#605348` | `#CCC3B8` | Dates, locations, metadata, and supporting labels.                |
| Border / divider          | `#8D8177` | `#968679` | Card edges and structural dividers.                               |
| Input boundary            | `#7B6B60` | `#988576` | Form controls and focus-adjacent boundaries.                      |
| Primary accent / walnut   | `#5F493A` | `#D3BB9C` | Active navigation, primary action, and focus ring.                |
| Secondary accent / olive  | `#DDE3D3` | `#49573D` | Today markers, quiet highlights, and planning cues.               |
| Success / positive        | `#4A785D` | `#95C6A7` | Completed, healthy, connected, and ready states.                  |
| Warning / attention       | `#93622A` | `#E0B87B` | Pending approval, moderate risk, and look-soon states.            |
| Error / urgent            | `#934034` | `#E19B8E` | Overdue, failed, severe, and action-now states.                   |
| Informational             | `#486A75` | `#97C0CE` | Weather, travel, sync, and neutral system information.            |
| Disabled surface          | `#D7D1CB` | `#61564C` | Inactive controls and unavailable content.                        |
| Disabled text             | `#847C75` | `#AEA598` | Labels on disabled controls; never use for essential information. |

### Widget family surfaces

These surfaces are intentionally low-chroma and close to the room materials.
They create grouping without making the dashboard look like a collection of
separate applications.

| Family                                       | Day       | Night     |
| -------------------------------------------- | --------- | --------- |
| Calendar                                     | `#FAF6EF` | `#362D26` |
| Planning — tasks, shopping, meals, chores    | `#EBEFE7` | `#333A2C` |
| Family — messages, birthdays, points, wishes | `#F5EBE5` | `#3C2F2A` |
| Information — clock, weather, travel         | `#F3F1EC` | `#3D382F` |
| Today marker                                 | `#DCE2D4` | `#46513D` |

Primary and muted text are chosen for WCAG AA text contrast on the intended
surfaces. Borders are structural separators, not typography. The dark mode
keeps the warm text luminance high while keeping the surrounding surfaces
well below daylight brightness.

## CSS variables

Prism uses space-separated HSL values for its theme contract. This is the
drop-in core token set for Cedar & Clay.

```css
:root[data-color-theme='cedar'] {
  --background: 31 28% 84%;
  --foreground: 23 28% 16%;
  --card: 36 49% 95%;
  --card-foreground: 23 28% 16%;
  --popover: 34 46% 92%;
  --popover-foreground: 23 28% 16%;
  --primary: 25 24% 30%;
  --primary-foreground: 36 49% 95%;
  --secondary: 31 41% 89%;
  --secondary-foreground: 23 28% 16%;
  --muted: 34 46% 92%;
  --muted-foreground: 26 14% 33%;
  --accent: 84 22% 86%;
  --accent-foreground: 88 22% 23%;
  --destructive: 8 48% 39%;
  --destructive-foreground: 36 49% 95%;
  --border: 27 9% 51%;
  --input: 25 12% 43%;
  --ring: 25 24% 30%;

  --status-success: 145 24% 38%;
  --status-warning: 32 56% 37%;
  --status-error: 8 48% 39%;
  --status-info: 195 24% 37%;
  --disabled: 32 13% 82%;
  --disabled-foreground: 28 6% 49%;

  --shadow-color: 23 28% 16%;
  --shadow-card:
    0 10px 24px hsl(var(--shadow-color) / 0.1), 0 1px 2px hsl(var(--shadow-color) / 0.16);
  --shadow-card-hover:
    0 14px 30px hsl(var(--shadow-color) / 0.15), 0 2px 4px hsl(var(--shadow-color) / 0.16);
}

:root.dark[data-color-theme='cedar'] {
  --background: 24 17% 10%;
  --foreground: 35 40% 91%;
  --card: 27 18% 15%;
  --card-foreground: 35 40% 91%;
  --popover: 27 21% 18%;
  --popover-foreground: 35 40% 91%;
  --primary: 34 39% 72%;
  --primary-foreground: 26 28% 15%;
  --secondary: 28 18% 23%;
  --secondary-foreground: 35 40% 91%;
  --muted: 27 21% 18%;
  --muted-foreground: 34 16% 76%;
  --accent: 92 18% 29%;
  --accent-foreground: 35 40% 91%;
  --destructive: 9 58% 72%;
  --destructive-foreground: 9 32% 14%;
  --border: 28 12% 53%;
  --input: 27 14% 53%;
  --ring: 37 48% 74%;

  --status-success: 142 30% 68%;
  --status-warning: 36 62% 68%;
  --status-error: 9 58% 72%;
  --status-info: 195 36% 70%;
  --disabled: 27 12% 34%;
  --disabled-foreground: 34 12% 64%;

  --shadow-color: 24 17% 6%;
  --shadow-card:
    0 10px 28px hsl(var(--shadow-color) / 0.34), 0 1px 3px hsl(var(--shadow-color) / 0.4);
  --shadow-card-hover:
    0 16px 36px hsl(var(--shadow-color) / 0.4), 0 2px 5px hsl(var(--shadow-color) / 0.44);
}
```

Use `bg-status-warning/10`, `text-status-warning`, and their semantic
success/error/info equivalents in widgets. The exact hue remains theme-owned.

## Application rules

- Keep some plaster visible around every card; the wall should remain part of
  the composition.
- Use walnut for one active action or focus target at a time. It is a quiet
  anchor, not a decorative fill for every control.
- Use olive for “today,” healthy planning, and calm grouping. It should feel
  botanical, not neon green.
- Use fired-clay/warning tones for small attention cues. Pair them with a
  label, icon, shape, or rule; never use color alone for urgency.
- Reserve error for overdue, failed, or action-now conditions. Keep normal
  content free from red so an alert retains its visual meaning.
- Use Sunset brightness mode on the wall. Start with a 30–60 minute negative
  offset if warm evening lights come on before sunset, then tune in the room.

## Component mapping

| Component                 | Surface                  | Treatment                                                           |
| ------------------------- | ------------------------ | ------------------------------------------------------------------- |
| Clock / date              | Information              | Large espresso/warm-cream time; date and greeting use muted text.   |
| Weather                   | Information              | Current temperature in primary text; forecast ramp stays muted.     |
| Family calendar           | Calendar                 | Event names use primary text; today uses the olive marker/ring.     |
| Upcoming events           | Calendar or card         | Next event gets stronger weight and a walnut rule; metadata muted.  |
| Reminders / tasks         | Planning                 | Task text primary; completion uses a check plus success treatment.  |
| Home status               | Information              | “All clear” uses success; attention uses warning plus a label.      |
| Navigation                | Card / secondary surface | Active destination uses walnut; inactive links use muted text.      |
| Alert / notification card | Relevant family surface  | Use a 3–4px status rule, icon, short label, and readable body text. |

Cedar & Clay is intended to be recognizable from across the kitchen without
becoming the brightest object in the room. It has more material warmth and
less “software tint” than the previous direction while retaining clear status
hierarchy and distance legibility.
