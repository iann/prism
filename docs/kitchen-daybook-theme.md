# Daybook — paper-planner kitchen theme

Daybook is Prism's Skylight-inspired direction. It takes the useful visual
idea from dedicated family calendars—a quiet, paper-like canvas with color
doing the organizational work—and gives it Prism's own palette and semantic
tokens.

The reference pattern is deliberately structural rather than literal:
Skylight's official interface keeps the navigation and information bars
white, uses dark charcoal type, and assigns each family/calendar a distinct
color. Its product imagery shows powder blue, sage, butter, blush, and small
coral/ochre/teal identity marks. See the [navigation reference](https://skylight.zendesk.com/hc/en-us/articles/36824456433051-Navigation-and-Menus),
[profile-color reference](https://skylight.zendesk.com/hc/en-us/articles/360032743912-How-do-I-change-the-color-of-my-profiles),
and [official calendar examples](https://uk.myskylight.com/calendar/).

## Concept

The display should read like a well-designed family planner mounted on the
wall: light paper, dark ink, and a handful of colored tabs. The canvas is
cooler and cleaner than Mosaic Market, and every preset widget shell shares
that canvas so the dashboard recedes into the room as one composed surface.
The broader palette lives in event rules, chips, chart series, today markers,
and status accents rather than competing panel fills.

Daybook's color grammar is:

- Ink blue-black is for time, titles, and important values.
- Powder blue is for weather, travel, and neutral information.
- Sage is for planning, chores, and routines.
- Blush/coral is for family communication and warm household content.
- Butter is for today, meals, and selected emphasis.
- Teal is for actions, navigation, focus, and sync.
- Coral-red, amber, green, and blue remain reserved for status meaning.

The dark variant keeps the same roles as a low-luminance evening planner: ink
becomes deep navy, paper interiors become slate, and the pastel roles become
small dark-toned cues with lifted text and accent colors.

## Palette

### Core roles

| Role                  | Day       | Night     | Intended use                                         |
| --------------------- | --------- | --------- | ---------------------------------------------------- |
| Main background       | `#C6D1DC` | `#1A1F28` | Page canvas, gaps, and preset widget shells.         |
| Elevated/card surface | `#FFFFFF` | `#2A303C` | Contained cards, calendar paper, and raised content. |
| Popover surface       | `#FFFFFF` | `#323A48` | Dialogs, menus, and transient overlays.              |
| Primary text / ink    | `#212631` | `#F7F2E9` | Clock, titles, event names, and key values.          |
| Secondary text        | `#404959` | `#E1D8CC` | Dates, metadata, locations, and labels.              |
| Border / divider      | `#546478` | `#8491A4` | Structural boundaries; use sparingly.                |
| Input boundary        | `#52637A` | `#8797AB` | Inputs and control edges.                            |
| Primary teal          | `#237BA4` | `#78C3E2` | Active navigation, primary actions, focus, and sync. |
| Butter accent         | `#F7D687` | `#7E601B` | Today, meal cues, and selected emphasis.             |
| Destructive / urgent  | `#822217` | `#F0988F` | Errors, overdue items, and action-now states.        |

### Widget shells and internal accents

The widget shell is intentionally the same color as the main background. This
keeps the wall display from looking like a collection of unrelated cards. The
following colors remain available for small internal surfaces, rules, chips,
and markers; they are not used as full widget backgrounds.

| Role                      | Day       | Night     | Intended use                                      |
| ------------------------- | --------- | --------- | ------------------------------------------------- |
| Widget shell              | `#C6D1DC` | `#1A1F28` | All preset widget containers; same as the canvas. |
| Calendar / paper interior | `#FFFFFF` | `#2F3542` | Dates, event lists, and contained calendar areas. |
| Today marker              | `#F8E8BF` | `#74591B` | Current day, selected date, and meal emphasis.    |
| Planning / sage accent    | `#D3EEDD` | `#2A4635` | Small task, chore, shopping, and routine cues.    |
| Family / blush accent     | `#F0A99E` | `#4D312E` | Small message, birthday, wish, and family cues.   |
| Information / powder blue | `#E6F4F9` | `#2E4752` | Forecast bands, travel cues, and neutral info.    |

### Identity and chart accents

These are the concentrated color chips inspired by color-coded family
profiles. Use them as dots, avatar fills, event rules, chart series, or small
badges—not as full-screen backgrounds.

| Accent      | Day       | Night     | Meaning                                  |
| ----------- | --------- | --------- | ---------------------------------------- |
| Coral       | `#DB4F33` | `#EE9381` | Warm household or family identity.       |
| Powder blue | `#2994C2` | `#82CDED` | Cool identity, weather, or data series.  |
| Sage green  | `#3B9B63` | `#7DD9A3` | Planning or completed activity.          |
| Ochre       | `#D19A1A` | `#F6D179` | Meals, today, or a deliberate highlight. |
| Plum        | `#8D53AC` | `#CCA0E3` | A fifth family/calendar identity.        |

### Status roles

| State            | Day       | Night     | Usage                                   |
| ---------------- | --------- | --------- | --------------------------------------- |
| Success          | `#2A8451` | `#70DB9D` | Complete, healthy, connected, ready.    |
| Warning          | `#AA6118` | `#F4BE67` | Pending, moderate risk, look soon.      |
| Error            | `#B63425` | `#EF8B80` | Overdue, failed, severe, action now.    |
| Informational    | `#27789B` | `#8BCDE9` | Sync, neutral update, weather, transit. |
| Disabled surface | `#D6DBE1` | `#474F5C` | Inactive or unavailable controls.       |
| Disabled text    | `#656D7B` | `#BEB29D` | Disabled labels only.                   |

## CSS variables

Prism uses space-separated HSL values. The complete token set is in
`src/lib/themes/appThemes.ts`; this is the drop-in core for custom surfaces:

```css
:root[data-color-theme='daybook'] {
  --background: 210 24% 82%;
  --foreground: 222 20% 16%;
  --card: 0 0% 100%;
  --card-foreground: 222 20% 16%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 20% 16%;
  --primary: 199 65% 39%;
  --primary-foreground: 0 0% 100%;
  --secondary: 204 28% 90%;
  --secondary-foreground: 222 20% 16%;
  --muted: 214 24% 92%;
  --muted-foreground: 218 16% 30%;
  --accent: 42 88% 75%;
  --accent-foreground: 222 20% 16%;
  --destructive: 6 70% 30%;
  --destructive-foreground: 0 0% 100%;
  --border: 214 18% 40%;
  --input: 214 20% 40%;
  --ring: 199 65% 32%;

  --chart-1: 10 70% 53%;
  --chart-2: 198 65% 46%;
  --chart-3: 145 45% 42%;
  --chart-4: 42 78% 46%;
  --chart-5: 279 35% 50%;

  --calendar-surface: 0 0% 100%;
  --calendar-today: 43 80% 86%;
  /* Preset widget shells intentionally merge with the page canvas. */
  --widget-calendar: 210 24% 82%;
  --widget-planning: 210 24% 82%;
  --widget-family: 210 24% 82%;
  --widget-info: 210 24% 82%;
}

:root.dark[data-color-theme='daybook'] {
  --background: 220 22% 13%;
  --foreground: 38 45% 94%;
  --card: 220 18% 20%;
  --card-foreground: 38 45% 94%;
  --popover: 220 18% 24%;
  --popover-foreground: 38 45% 94%;
  --primary: 198 65% 68%;
  --primary-foreground: 220 22% 13%;
  --secondary: 215 17% 28%;
  --secondary-foreground: 38 45% 94%;
  --muted: 218 15% 24%;
  --muted-foreground: 36 26% 84%;
  --accent: 42 65% 30%;
  --accent-foreground: 38 45% 94%;
  --destructive: 6 76% 75%;
  --destructive-foreground: 6 40% 15%;
  --border: 215 15% 58%;
  --input: 214 18% 60%;
  --ring: 198 65% 74%;

  --calendar-surface: 220 17% 22%;
  --calendar-today: 42 62% 28%;
  /* Preset widget shells intentionally merge with the page canvas. */
  --widget-calendar: 220 22% 13%;
  --widget-planning: 220 22% 13%;
  --widget-family: 220 22% 13%;
  --widget-info: 220 22% 13%;
}
```

## Application rules

- Keep the page background cool and quiet, and let the shared widget shell
  visually recede into it. Put the color inside the widgets: event rules,
  chips, chart series, today markers, and compact status treatments.
- Use one or two family/calendar colors per view. More than five competing
  identity colors makes the wall display noisy.
- Treat the colored dots and event rules as identity markers. Keep event text
  dark ink in the day variant and warm light ink in the night variant.
- Use teal for active navigation and primary actions. Do not turn every
  interactive affordance into a filled teal pill.
- Use butter for “today” and “selected,” never for errors or warnings.
- Status cards should combine a color rule or icon with a text label and, when
  useful, an icon shape. Never rely on hue alone for a critical state.
- Keep warning/error fills compact: a 3–4px rule, icon, or badge is usually
  enough at wall distance.

## Component mapping

| Component                  | Daybook treatment                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| Clock / date               | Shared canvas shell; large ink time; teal sync/location cue and optional powder-blue detail.     |
| Weather                    | Shared canvas shell; blue-to-sage-to-coral weather ramp in charts; teal rain/sync cue.           |
| Family calendar            | Contained white paper area; butter current-day marker; identity dots and event rules.            |
| Upcoming events            | Shared canvas shell; one colored rule per calendar; ink event names.                             |
| Reminders / tasks          | Shared canvas shell; sage chips/checks for planning; coral-red only for overdue.                 |
| Home status                | Shared canvas shell; compact status rule plus icon and label.                                    |
| Navigation                 | Shared canvas/card surface; active destination teal; selected date or secondary emphasis butter. |
| Alert / notification cards | Shared shell with a saturated status rule, icon, label, and readable body.                       |

## Elevation and ambient behavior

Daybook should feel like layered paper, not floating software panels:

```css
:root[data-color-theme='daybook'] {
  --shadow-card: 0 8px 22px hsl(222 20% 16% / 0.1), 0 1px 2px hsl(222 20% 16% / 0.16);
}

:root.dark[data-color-theme='daybook'] {
  --shadow-card: 0 10px 28px hsl(220 22% 6% / 0.38), 0 1px 3px hsl(220 22% 6% / 0.44);
}
```

Use 10–14px corner radii, soft shadows, and visible but not hairline-thin
boundaries. Day cards can use nearly opaque surfaces; night cards should stay
opaque enough to avoid wallpaper glow leaking through. Sunset mode is still
recommended, with a 30–60 minute negative offset if the kitchen lights come
on before local sunset.
