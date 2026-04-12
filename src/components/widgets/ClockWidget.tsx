/**
 *
 * Displays the current time and date on the dashboard.
 * This is one of the most essential widgets - always visible at a glance.
 *
 * FEATURES:
 * - Large, readable time display
 * - Current date with day of week
 * - Optional seconds display
 * - 12-hour or 24-hour format (configurable)
 * - Updates in real-time
 *
 * DESIGN CONSIDERATIONS:
 * - Large font for visibility from across the room
 * - High contrast for easy reading
 * - Minimal design to not distract
 * - Updates smoothly without flickering
 *
 * USAGE:
 *   <ClockWidget />
 *   <ClockWidget showSeconds />
 *   <ClockWidget format24Hour />
 *
 */

'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer } from './WidgetContainer';


/**
 * CLOCK WIDGET PROPS
 */
export interface ClockWidgetProps {
  /** Show greeting message above the time */
  showGreeting?: boolean;
  /** Show seconds in the time display */
  showSeconds?: boolean;
  /** Use 24-hour format (e.g., 14:30 vs 2:30 PM) */
  format24Hour?: boolean;
  /** Show the date below the time */
  showDate?: boolean;
  /** Widget size variant */
  size?: 'small' | 'medium' | 'large';
  /** Additional CSS classes */
  className?: string;
}


/**
 * CLOCK WIDGET COMPONENT
 * Displays the current time and date.
 *
 * HOW IT WORKS:
 * 1. Uses useState to store the current time
 * 2. useEffect sets up an interval to update every second
 * 3. Formats time/date using date-fns library
 * 4. Cleans up interval on unmount to prevent memory leaks
 *
 * PERFORMANCE NOTE:
 * The interval updates every second. For a battery-powered device,
 * you might want to update less frequently (every minute) and hide seconds.
 *
 * @example Basic usage
 * <ClockWidget />
 *
 * @example With seconds, 24-hour format
 * <ClockWidget showSeconds format24Hour />
 *
 * @example Compact (no date)
 * <ClockWidget showDate={false} />
 */
export const ClockWidget = React.memo(function ClockWidget({
  showGreeting = true,
  showSeconds = false,
  format24Hour = false,
  showDate = true,
  size = 'medium',
  className,
}: ClockWidgetProps) {
  // State to hold the current time
  // Initialize with current time to avoid hydration mismatch
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Update the time every second
  useEffect(() => {
    // Update immediately on mount
    setCurrentTime(new Date());

    // Set up interval for updates
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    // Cleanup: Clear interval when component unmounts
    // This prevents memory leaks
    return () => clearInterval(intervalId);
  }, []);

  // Format strings for date-fns
  // See: https://date-fns.org/docs/format
  const timeFormat = format24Hour
    ? showSeconds ? 'HH:mm:ss' : 'HH:mm'
    : showSeconds ? 'h:mm:ss a' : 'h:mm a';

  const dateFormat = 'EEEE, MMMM d'; // e.g., "Tuesday, January 21"

  // Formatted strings
  const timeString = format(currentTime, timeFormat);
  const dateString = format(currentTime, dateFormat);

  // Greeting logic
  const getGreeting = (date: Date) => {
    const hour = date.getHours();
    const dateStr = format(date, 'yyyy-MM-dd');

    // Define greeting buckets
    const greetings = {
      morning: [
        'Good morning', 'Morning', 'Rise and shine', 'Mornin\'', 'Top of the morning',
        'Wakey wakey', '¡Buenos días!', 'Buen día', 'Bonjour', 'Salut',
        'Guten Morgen', 'Morgen', 'Buongiorno', 'Bom dia', 'Goedemorgen',
        'Mogge', 'God morgon', 'Howdy', 'G\'day', 'Yo', 'Up and at \'em',
        'Morning sunshine', 'Early bird!', 'Moin moin', 'Servus', 'Grüß Gott',
        'Dzień dobry', 'Günaydın', 'Magandang umaga', 'Selamat pagi', 'Bună dimineața',
        'Hyvää huomenta', 'God morgen', 'What\'s cracking?', 'New day!', 'Ahoj',
        'Ciao', 'Ello', 'Top o\' the mornin\'', '\'Allo \'allo', 'Breezy morning!',
        'Wake up!', 'Hello world', 'S\'up', 'Hiya', 'Cheerio', 'Gidday',
        'Coucou', 'Hey there', 'Rise up', 'Good morrow', 'Bright and early',
        'Sun\'s up', 'Gm', 'Hails', 'Greetings', 'Salutations', 'Morning star',
        'First light', 'Dawn is here', 'Awake yet?', 'Ready for the day?',
        'Let\'s go!', 'Today is the day', 'A new beginning', 'Seize the day',
        'Carpe diem', 'Fresh start', 'Morning vibes', 'Coffee first',
        'But first coffee', 'Caffeine loading', 'Sleepyhead', 'Time to shine',
        'Wagwan', 'Aight', 'Howzit', 'Heya', 'What\'s the move?', 'Let\'s get it',
        'Bon matin', 'Alles gut?', 'Giorno', 'Bom dia pra você', 'Olá', 'Oi',
        'Goeiemorgen', 'Godmorgon', 'Morn', 'Siema', 'Merhabalar', 'Selamat siang',
        'Dobre jutro', 'Sabahınız xeyir', 'Tere hommikust', 'Labas rytas',
        'Labrīt', 'Buna', 'Howdy-do', 'Mornin\' sunshine', 'Wake up call',
        'New dawn', 'Brand new day', 'Up and early', 'Early days', 'Start strong',
        'Morning world', 'Hey sunshine', 'Up and away', 'Daybreak', 'Aurora',
        'Sunbeam', 'Dewy morning', 'Fresh air', 'Morning breeze', 'Wakey',
        'Rise and grind', 'Hustle time', 'Get after it', 'Make it happen',
        'Today is yours', 'Kickstart', 'Ignite', 'Awaken', 'Revive', 'Thrive',
        'Shine bright', 'Radiate', 'Morning magic', 'Pure morning', 'Peaceful morning',
        'Quiet morning', 'Serene start', 'First coffee', 'Java time', 'Brewing',
        'Sunrise vibes', 'Early start', 'Before the world wakes', 'The early bird',
        'Crows at dawn', 'Chirp chirp', 'Tweet tweet', 'Singing birds',
        'Morning dew', 'Crisp morning', 'Cold morning', 'Warm morning', 'Sunny start',
        'Land ho!', 'Clear skies ahead', 'Egg-cellent morning', 'Cereal killer',
        'Donut worry, be happy', 'Be the light', 'Start with a smile', 'Make a difference',
        'Wotcha', 'Ey up', 'Fit like', 'Top of the stack', 'First tracks', 'Fresh ink',
        'Page one', 'Chapter one', 'New leaf', 'Green light', 'Go time', 'Full steam ahead',
        'Anchors aweigh', 'Off to the races', 'Bright eyes', 'Bushy tail', 'Early doors',
        'First bell', 'Sunrise state of mind', 'Morning zen', 'Peaceful waking',
        'Soft light', 'Golden hour', 'Day one', 'Let\'s build', 'Positive vibes only',
        'Today will be great', 'Morning motivation', 'Early grind', 'Rise and flourish',
        'Bloom where you are planted', 'Morning grace', 'Fresh perspective', 'Clear mind',
        'New opportunities', 'Awake and grateful', 'Living the dream', 'Morning bliss',
        'Sunlight on your face', 'Breath of fresh air', 'First rays', 'Breaking dawn',
        'Morning spirit', 'Ready to conquer', 'World is waiting', 'Shine on', 'You got this',
        'Morning high', 'Start fresh', 'Clean slate', 'New possibilities', 'Morning wonder',
        'Magic in the air', 'Today\'s a gift', 'Present moment', 'Just keep swimming',
        'Onward!', 'Sky\'s the limit', 'Blue skies', 'Morning power', 'Strong start',
        'Fast start', 'Morning flow', 'Wakey wakey, eggs and bakey', 'Sun is peaking',
        'Dew is on the grass', 'Alarm is off', 'Yawn...', 'Stretch!', 'Kumbaya',
        'Here comes the sun', 'Beautiful day', 'Morning has broken', 'Good morning starshine',
        'Circle of Life', 'Walking on sunshine', 'Feeling good', 'A new hope',
        'The eagle has landed', 'One small step', 'Houston, we have a morning',
        'Engage!', 'Make it so', 'To infinity and beyond', 'Just keep swimming',
        'A whole new world', 'The hills are alive', 'My favorite things',
        'Singin\' in the rain', 'Don\'t worry, be happy', 'One love', 'Positive vibration',
        'Wake up and live', 'What a wonderful world', 'Somewhere over the rainbow',
        'Don\'t stop me now', 'Mr. Blue Sky', 'Lovely day', 'Sun is shining',
        'Three little birds', 'Morning mood', 'Vivaldi\'s Spring', 'Ode to Joy',
        'Hallelujah', 'Dancing in the light', 'God bless the child', 'Nants ingonyama',
        'Prithee, good morrow', 'Hark! The dawn', 'Once upon a time', 'Call me Morning',
        'Impression, Sunrise', 'The sun also rises', 'Mrs. Dalloway\'s dawn',
        'Gatsby\'s green light', 'Atticus\'s morning', 'Aslan\'s morning',
        'Gandalf\'s morning', 'Frodo\'s morning', 'Sherlock\'s morning',
        'Watson\'s morning', 'Poirot\'s morning', 'Marple\'s morning',
        'Elementary, my dear Watson', 'I am back', 'Live long and prosper',
        'New day, new dawn', 'Morning caffeine', 'Steam in the cup',
        'Java morning', 'Brewing joy', 'First sip', 'Morning ritual',
        'Radiant start', 'Breathe in the morning', 'Morning calmness',
        'Serenity now', 'Peaceful start', 'Quiet contemplation', 'Mindful morning',
        'Gratitude start', 'Blessed morning', 'Infinite possibilities',
        'Uncharted territory', 'Morning explorer', 'Pathfinder', 'Trailblazer',
        'Wayfinder', 'Morning navigator', 'Set the course', 'Full sail',
        'Morning tide', 'Ocean breeze', 'Mountain air', 'Forest morning',
        'Meadow light', 'Garden dawn', 'Crisp start', 'Invigorated', 'Refreshed',
        'Renewed', 'Restored', 'Revitalized', 'Morning strength', 'Empowered',
        'Ready', 'Steady', 'Go!', 'Kickstart your day', 'Ignite your passion',
        'Pursue your dreams', 'Make your mark', 'Leave a legacy', 'Be the change',
        'Kindness first', 'Compassion morning', 'Love and light', 'Morning peace',
        'Harmony start', 'Balanced day', 'Centered morning', 'Grounded start',
        'High frequency morning', 'Vibrant start', 'Luminous morning',
        'Bright and bold', 'Magnificent morning', 'Splendid start',
        'Wonderful waking', 'Glorious dawn', 'Exalted morning', 'Majestic sunrise',
        'Noble start', 'Virtuous morning', 'Honorable day', 'Authentic morning',
        'A rose by any other name', 'To be, or not to be', 'Great Expectations for today',
        'Moby Dick\'s Morning', 'The Old Man and the Sea Morning', 'The Odyssey Morning',
        'The Iliad Morning', 'The Aeneid Morning', 'Divine Comedy Morning',
        'Paradise Lost Morning', 'Frankenstein\'s Morning', 'Alice in Wonderland Morning',
        'Peter Pan\'s Morning', 'Treasure Island Morning', 'Robinson Crusoe Morning',
        'Gulliver\'s Travels Morning', 'Oliver Twist\'s Morning', 'David Copperfield\'s Morning',
        'Middlemarch Morning', 'Silas Marner Morning', 'Adam Bede Morning',
        'Wuthering Heights Morning', 'Jane Eyre\'s Morning', 'Emma\'s Morning',
        'Sense and Sensibility Morning', 'Persuasion\'s Morning', 'Sanditon\'s Morning',
        'The sun is up, and \'tis a morn of May', 'What early tongue so sweet saluteth me?',
        'Solar wind\'s up', 'Heliocentric hello', 'Solar flare start', 'Corona morning',
        'The eagle has landed', 'One small step', 'Fellowship of the morning',
        'Bilbo\'s morning', 'A long time ago in a morning far, far away', 'Morning star is bright',
        'Galaxy\'s greeting', 'Cosmic morning', 'Interstellar day', 'Stardust morning',
        'Quantum dawn', 'Molecular morning', 'Evolution of today', 'Nature\'s alarm',
        'Forest\'s whisper', 'Mountain\'s peak', 'Ocean\'s roar', 'River\'s flow',
        'Lake\'s mirror', 'Puddle jumper', 'Cloud chaser', 'Sky high morning',
        'Atmospheric morning', 'Stratospheric start', 'Exospheric hello', 'Lunar legacy',
        'Solar flare morning', 'Photospheric pulse', 'Northern lights morning',
        'Magnetic morning', 'Electric start', 'Frequency of day', 'Wavelength of light',
        'Spectrum of color', 'Prism of possibilities', 'Refraction of joy',
        'Binary morning', 'Hello World', 'Digital dawn', 'Hertz of the day',
        'Infinite morning', 'Eternal start', 'Genesis of today', 'Numbers of the day'
      ],
      afternoon: [
        'Good afternoon', 'Afternoon', 'Hello', 'Hi', 'Hey', 'Hiya',
        '¡Buenas tardes!', 'Hola', 'Bon après-midi', 'Salut',
        'Guten Tag', 'Mahlzeit', 'Buon pomeriggio', 'Ciao', 'Boa tarde',
        'Goedemiddag', 'God middag', 'G\'day', 'S\'up', 'Yo', 'What\'s cracking?',
        'What\'s good?', 'Greetings', 'Howdy', 'Wagwan', 'Aight', 'Lunch time?',
        'Stay cool', 'Dzień dobry', 'Tünaydın', 'Magandang hapon', 'Selamat siang',
        'Selamat sore', 'Bună ziua', 'Hyvää päivää', 'God dag', 'Ahoj', 'Salve',
        'Hey friend', 'Afternoon vibes', 'Hullo', 'How goes it?', 'What\'s up?',
        'Looking good!', 'Keep it up', 'Sunshine', 'Cheers', 'Good day',
        'Lovely day', 'Hi there', 'Howdy-do', 'Good afternoon to you',
        'Middle of the day', 'High noon', 'Still at it?',
        'Working hard?', 'Take a break', 'Relax', 'Breathe', 'Halfway there',
        'Keep going', 'You got this', 'Doing great', 'Hello again', 'Nice to see you',
        'What\'s the word?', 'How\'s it going?', 'What\'s the haps?', 'Yo yo',
        'Heyo', 'Sup', 'Peace', 'Vibes', 'Chill', 'Buenas', '¿Qué tal?',
        'Allô', 'Tag', 'Hallo', 'Tudo bem?', 'Middag', 'Goeiemiddag', 'Hej',
        'Merhabalar', 'Selam', 'Magandang tanghali', 'Dober dan', 'Poledne',
        'Afternoon tea', 'Siesta time', 'Post-lunch', 'The day continues',
        'Stay focused', 'Keep moving', 'Afternoon sun', 'Golden hour',
        'Bright afternoon', 'Clear day', 'Busy day', 'Productive day',
        'Almost there', 'Counting down', 'Nearly evening', 'Pre-dusk',
        'Afternoon flow', 'In the zone', 'Keep it moving', 'One step closer',
        'Success awaits', 'Doing big things', 'Grind continues', 'Afternoon light',
        'Shadows growing', 'Warm afternoon', 'Cool breeze', 'City life',
        'Nature calls', 'Walk time', 'Deep breath', 'Regroup', 'Refocus',
        'Carry on', 'Steady now', 'Keep it real', 'Stay true', 'Keep pushing',
        'Don\'t stop', 'Midday mood', 'Afternoon energy', 'Power through',
        'Finishing strong', 'Halfway point', 'Pivot', 'Execute', 'Deliver',
        'Manifest', 'Create', 'Inspire', 'Motivate', 'Elevate', 'Ascend',
        'Afternoon glow', 'Soft light', 'Gentle day', 'Mellow mood', 'Steady vibes',
        'Taco \'bout a great day', 'Lettuce celebrate', 'Crushing it', 'Winning',
        'Leveling up', 'Cruising', 'Flow state', 'Easy breezy', 'Sun\'s at the peak',
        'Midday mission', 'After-lunch lull', 'Pick-me-up', 'Staying positive',
        'Focus mode', 'Deep work', 'Making progress', 'Momentum', 'High tide',
        'Riding the wave', 'Afternoon breeze', 'Shade seeking', 'Water break',
        'Stay hydrated', 'Keep the fire', 'On the move', 'Going strong', 'Not long now',
        'Afternoon spirits', 'Bright side', 'Look up', 'Keep smiling', 'Afternoon cheer',
        'Sunny disposition', 'Warmth', 'Light', 'Energy', 'Vitality', 'Strength',
        'Purpose', 'Vision', 'Clarity', 'On track', 'Moving mountains', 'Making waves',
        'Creating impact', 'Building legacy', 'Step by step', 'Afternoon zen',
        'Grace under pressure', 'Resilient', 'Unstoppable', 'Focused', 'Driven',
        'Inspired', 'Creative', 'Productive', 'Efficient', 'Effective', 'Impactful',
        'Genuine', 'Kind', 'Helpful', 'Supportive', 'Present', 'Aware', 'Mindful',
        'Balanced', 'Centered', 'Harmonious', 'Peaceful', 'Joyful', 'Happy', 'Content',
        'Grateful', 'Blessed', 'Prosperous', 'Abundant', 'Limitless', 'Fearless', 'Bold',
        'Brave', 'Strong', 'Capable', 'Worthy', 'Enough', 'You\'re a star', 'Go get \'em',
        'Keep it 100', 'Vibing', 'Energy levels high', 'Peak productivity', 'Midday magic',
        'Sun\'s at the zenith', 'Power hour', 'Onwards and upwards',
        'Sunny afternoon', 'Walking on sunshine', 'Lovely day', 'Good day sunshine',
        'Sunshine of my life', 'Ain\'t no sunshine', 'Pocketful of sunshine',
        'Walking on a dream', 'Higher ground', 'I feel good', 'Superstition',
        'Signed, sealed, delivered', 'Isn\'t she lovely', 'Sir Duke', 'Master blaster',
        'Happy', 'Uptown funk', 'Get lucky', 'Can\'t stop the feeling',
        'Shake it off', 'Roar', 'Firework', 'Brave', 'Stronger', 'Titanium',
        'Steady as she goes', 'Maintain course', 'Cruising altitude', 'Full speed ahead',
        'Optimization mode', 'Midday mission', 'Data flow', 'Network stable',
        'Signal strong', 'Uptime', 'Latency low', 'Bandwidth high', 'Processing...',
        'Calculated', 'Verified', 'Confirmed', 'Authenticated', 'Authorized',
        'High noon', 'Meridian', 'Solstice light', 'Equinox', 'Meridian pulse',
        'Zenith vibes', 'Afternoon glow', 'Brightest hour', 'Full power',
        'In the flow', 'Making moves', 'Progressing', 'Developing', 'Evolving',
        'Growing', 'Expanding', 'Thriving', 'Successful afternoon', 'Impactful day',
        'Meaningful moments', 'Purposeful action', 'Clear direction', 'Steady progress',
        'Reliable results', 'Consistent effort', 'Determined start', 'Strong finish',
        'Halfway point', 'The turn', 'Pivot point', 'Midday reflection',
        'Afternoon check-in', 'How\'s it going?', 'You\'re doing it!', 'Keep at it',
        'Don\'t look back', 'Eyes on the prize', 'Finish line in sight',
        'Stay the course', 'True north', 'Steady hand', 'Calm mind', 'Focused heart',
        'Passionate action', 'Creative flow', 'Inspired doing', 'Mindful moments',
        'Grateful heart', 'Kind spirit', 'Generous soul', 'Helpful hands',
        'Positive energy', 'Vibrant afternoon', 'Radiant life', 'Luminous day',
        'Splendid afternoon', 'Wonderful day', 'Magnificent life', 'Glorious moment',
        'Exalted state', 'Noble pursuit', 'Virtuous action', 'Honorable effort',
        'Authentic self', 'Genuine life', 'Real progress', 'True success',
        'Middle of the journey', 'High noon sun', 'Meridian light', 'Equinox pulse',
        'Zenith mood', 'Meridian flow', 'Solar peak', 'Day\'s meridian', 'Meridian afternoon',
        'Meridian strength', 'High noon focus', 'Meridian energy', 'Meridian drive',
        'Meridian vision', 'Meridian clarity', 'Meridian purpose', 'Meridian impact',
        'Meridian result', 'Meridian success', 'Meridian growth', 'Meridian expansion',
        'Meridian life', 'Meridian spirit', 'Meridian heart', 'Meridian soul'
      ],
      evening: [
        'Good evening', 'Evening', '¡Buenas noches!', 'Noches', 'Bonsoir',
        'Salut', 'Guten Abend', 'Abend', 'Buonasera', 'Ciao',
        'Boa noite', 'Goedenavond', 'God kväll', 'Yo', 'Hey', 'Nighty night',
        'Stay gold', 'Peace out', 'Sleep tight', 'Sweet dreams', 'Dobry wieczór',
        'İyi akşamlar', 'Magandang gabi', 'Selamat malam', 'Bună seara',
        'Hyvää iltaa', 'God kveld', 'Ahoj', 'Salve', 'Evening vibes',
        'Late night?', 'Rest well', 'Sunset mood', 'Chill time', 'What\'s up?',
        'How was your day?', 'Nice evening', 'Hey you', 'Catch you later',
        'See ya', 'Until tomorrow', 'Sleepy head?', 'Moonlight', 'Starry night',
        'Stay cool', 'Good night', 'Sleep well', 'Night night', 'Dream big',
        'Rest up', 'Gn', 'Night', 'Peace', 'Later', 'Laters', 'Cya', 'Catch ya',
        'What\'s the move?', 'Chill vibes', 'Wind down', 'Relaxing', 'Buenas',
        '¿Cómo te fue?', 'Bonne soirée', 'Allô', 'Gute Nacht', 'Buonanotte',
        'Tudo bem?', 'Avond', 'Goeieavond', 'Slaap lekker', 'God natt',
        'Dobranoc', 'İyi geceler', 'Dobrý večer', 'Evening all', 'Sunset',
        'Nightfall', 'Twilight', 'Dusk', 'Gloaming', 'Evenin\'', 'To the moon',
        'Dream sweet', 'Sleep soundly', 'Rest easy', 'Goodnight moon',
        'Off to bed', 'Bedtime', 'Slumber time', 'Counting sheep', 'Lights out',
        'See you in the morning', 'End of the day', 'Day is done', 'Night owl',
        'Midnight oil', 'Late hours', 'Quiet night', 'Silent night',
        'Darkness falls', 'Starlight', 'Night sky', 'Cool night', 'Warm night',
        'Breezy evening', 'Home time', 'Relax now', 'Unwind', 'Decompress',
        'Let go', 'Reflect', 'Meditate', 'Be still', 'Peaceful night',
        'Calm evening', 'Soft evening', 'Shadows', 'Nocturnal', 'Sleepy time',
        'Tired eyes', 'Deep sleep', 'Restorative', 'Recharge', 'Renew',
        'See you soon', 'Tomorrow awaits', 'Sleep well tonight', 'Rest your soul',
        'Quiet mind', 'Gentle night', 'Velvet sky', 'Silver moon', 'Orbit',
        'Constellations', 'Galaxy', 'Universe', 'Cosmic', 'Eternal night',
        'Deep rest', 'Snoozing', 'Zzz', 'Dreamland', 'Over and out', 'Signing off',
        'Dusk til dawn', 'Stars are aligning', 'Night light', 'Pajama time',
        'Cozy vibes', 'Hot cocoa weather', 'Fireplace glow', 'Dreaming of tomorrow',
        'End of the chapter', 'Rest and reset', 'Quiet hours', 'The world sleeps',
        'Z-zone', 'Dream machine', 'Slumber party', 'Quietude', 'Solitude', 'Grace',
        'Stardust', 'Orion\'s belt', 'Milky Way', 'Evening prayer', 'Reflection time',
        'Gratitude', 'Peace of mind', 'Calm heart', 'Soft pillow', 'Warm blankets',
        'Nesting', 'Hibernate', 'Night bloom', 'Lunar light', 'Tides turning',
        'Shore at night', 'Lighthouse', 'Safe harbor', 'Guide you home', 'Night watch',
        'Guarded sleep', 'Angelic rest', 'Pure dreams', 'Mystic night', 'Enchanted evening',
        'Magic in the dark', 'Hidden wonders', 'Secrets of the night', 'Whisper of the wind',
        'Rustle of leaves', 'Crickets chirping', 'Owl\'s hoot', 'Night\'s melody',
        'Symphony of silence', 'Deep blue', 'Indigo sky', 'Purple haze', 'Midnight velvet',
        'Silk and stars', 'Celestial dance', 'Infinite space', 'Beyond the stars',
        'To the edge of the world', 'Quiet strength', 'Soft finish', 'Wrap up the day',
        'Mission accomplished', 'Well deserved rest', 'Proud of you', 'See you at dawn',
        'Till the sun rises', 'Light tomorrow with today', 'Rest in power', 'Sleep in peace',
        'Dream in color', 'Wake up refreshed', 'New strength tomorrow', 'The night is young',
        'Or is it?', 'Midnight snack?', 'One more page', 'Just a few more minutes',
        'Night cap', 'Sleepy vibes', 'Napping', 'Drowsy', 'Fading out', 'Dim the lights',
        'Silence is golden', 'Night\'s embrace', 'Tuck in', 'Snuggle up', 'Cozy corner',
        'Home sweet home', 'Evening grace', 'Blessing', 'Goodnight world',
        'Evening star', 'Fly me to the moon', 'Starry starry night', 'Night moves',
        'Mr. Sandman', 'Dream a little dream', 'Brahms\' Lullaby', 'Twinkle twinkle',
        'Star light, star bright', 'Across the universe', 'Rocket man', 'Space oddity',
        'Starman', 'The passenger', 'After dark', 'Night fever', 'Stayin\' alive',
        'How deep is your love', 'Night birds', 'Smooth operator', 'Nightcall',
        'Midnight city', 'Electric feel', 'Pursuit of happiness', 'Day \'n\' nite',
        'Lights out', 'System shutdown', 'Defragmenting', 'Backup complete',
        'Cloud sync finished', 'Dark mode enabled', 'Sleep mode', 'Hibernate',
        'Standby', 'Safe harbor', 'Anchored', 'Port side', 'Starboard night',
        'Celestial navigation', 'North star', 'Polaris', 'Sirius', 'Vega',
        'Altair', 'Deneb', 'Betelgeuse', 'Rigel', 'Antares', 'Spica',
        'Arcturus', 'Aldebaran', 'Capella', 'Pollux', 'Castor', 'Regulus', 'Fomalhaut',
        'Evening glow', 'Dusk settled', 'Quietude', 'Serenity', 'Peaceful ending',
        'Reflection point', 'Graceful exit', 'Mindful rest', 'Grateful heart',
        'Softening', 'Release', 'Letting go', 'Transition', 'Threshold',
        'Liminal space', 'Dream portal', 'Star gate', 'Celestial bridge',
        'Infinite peace', 'Eternal rest', 'Alpha and Omega', 'Beginning of night',
        'End of effort', 'Pure silence', 'Sacred quiet', 'Divine rest',
        'Holistic sleep', 'Balanced being', 'Centered soul', 'Harmonious heart',
        'Resilient spirit', 'Determined dream', 'Successful sleep', 'Impactful rest',
        'Meaningful night', 'Purposeful pause', 'Clear conscience', 'Steady breath',
        'Reliable rest', 'Consistent calm', 'Faithful night', 'Trusting sleep',
        'Loving night', 'Kind dreams', 'Generous rest', 'Supportive slumber',
        'The curfew tolls the knell of parting day', 'Parting is such sweet sorrow',
        'Starry starry night (Vincent)', 'Night and day', 'Fly me to the moon',
        'Across the universe', 'Rocket man', 'Space oddity', 'Starman',
        'To the moon and back', 'Midnight train', 'Night shift', 'After hours',
        'Under the moonlight', 'Stardust evening', 'Galaxy\'s sleep', 'Cosmic rest',
        'Interstellar night', 'Stardust slumber', 'Quantum night', 'Digital dusk',
        'Safe harbor night', 'Celestial navigation night', 'North star guidance',
        'Polaris light', 'Sirius glow', 'Evening zen', 'Mindful rest', 'Peaceful sleep',
        'Restorative night', 'Recharging', 'Renewing', 'Dream portal open'
      ]
    };

    // Determine bucket
    let bucket: keyof typeof greetings = 'evening';
    if (hour >= 0 && hour < 12) bucket = 'morning';
    else if (hour >= 12 && hour < 17) bucket = 'afternoon';

    // Sticky selection: use date string to create a deterministic index
    const list = greetings[bucket];
    const hash = dateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = hash % list.length;

    return list[index];
  };
  const greeting = getGreeting(currentTime);

  // Size-based styling
  const greetingStyles = {
    small: 'text-lg mb-0',
    medium: 'text-2xl mb-1',
    large: 'text-4xl mb-2',
  };

  const timeStyles = {
    small: 'text-3xl',
    medium: 'text-5xl',
    large: 'text-7xl',
  };

  const dateStyles = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-xl',
  };

  return (
    <WidgetContainer
      title="Clock"
      icon={<Clock className="h-4 w-4" />}
      size={size === 'large' ? 'wide' : 'small'}
      showHeader={false}
      className={cn('flex items-center justify-center', className)}
    >
      <div className="flex flex-col items-center justify-center h-full text-center">
        {/* GREETING DISPLAY */}
        {showGreeting && (
          <div
            className={cn(
              'font-medium tracking-wider',
              greetingStyles[size]
            )}
          >
            {greeting}
          </div>
        )}

        {/* TIME DISPLAY */}
        <time
          dateTime={currentTime.toISOString()}
          className={cn(
            // Font styling
            'font-bold tracking-tight',
            // Tabular numbers for consistent width
            'tabular-nums',
            // Size-based class
            timeStyles[size]
          )}
        >
          {timeString}
        </time>

        {/* DATE DISPLAY */}
        {showDate && (
          <time
            dateTime={currentTime.toISOString().split('T')[0]}
            className={cn(
              'text-muted-foreground mt-1',
              dateStyles[size]
            )}
          >
            {dateString}
          </time>
        )}
      </div>
    </WidgetContainer>
  );
});


/**
 * USE CURRENT TIME HOOK
 * Custom hook for getting the current time with auto-update.
 * Can be used in other components that need real-time time.
 *
 * @param updateInterval - How often to update (ms), default 1000
 * @returns Current Date object
 *
 * @example
 * function MyComponent() {
 *   const time = useCurrentTime(60000); // Update every minute
 *   return <div>{format(time, 'h:mm a')}</div>;
 * }
 */
export function useCurrentTime(updateInterval = 1000): Date {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    setTime(new Date());

    const intervalId = setInterval(() => {
      setTime(new Date());
    }, updateInterval);

    return () => clearInterval(intervalId);
  }, [updateInterval]);

  return time;
}


/**
 * FORMAT TIME
 * Utility function to format time consistently throughout the app.
 *
 * @param date - Date to format
 * @param options - Formatting options
 * @returns Formatted time string
 *
 * @example
 * formatTime(new Date()) // "2:30 PM"
 * formatTime(new Date(), { format24Hour: true }) // "14:30"
 * formatTime(new Date(), { showSeconds: true }) // "2:30:45 PM"
 */
export function formatTime(
  date: Date,
  options: { format24Hour?: boolean; showSeconds?: boolean } = {}
): string {
  const { format24Hour = false, showSeconds = false } = options;

  const formatString = format24Hour
    ? showSeconds ? 'HH:mm:ss' : 'HH:mm'
    : showSeconds ? 'h:mm:ss a' : 'h:mm a';

  return format(date, formatString);
}
