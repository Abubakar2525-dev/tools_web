/** Word → emoji dictionary (original selection) and translator. Self-contained. */

const RAW = `
happy 😊|smile 😄|laugh 😂|lol 😂|funny 🤣|sad 😢|cry 😭|crying 😭|angry 😠|mad 😡|love ❤️|loves ❤️|heart ❤️|hearts 💕|kiss 😘|wink 😉
cool 😎|nerd 🤓|think 🤔|thinking 🤔|wow 😮|surprised 😲|shocked 😱|scared 😨|afraid 😨|tired 😴|sleep 😴|sleepy 😪|sick 🤒|ill 🤒
yum 😋|tasty 😋|delicious 😋|silly 🤪|crazy 🤪|shy 😳|embarrassed 😳|confused 😕|worried 😟|nervous 😬|calm 😌|relaxed 😌|proud 🥹
party 🥳|celebrate 🎉|celebration 🎉|congrats 🎉|congratulations 🎉|cheers 🥂|hello 👋|hi 👋|bye 👋|goodbye 👋|wave 👋|yes 👍|ok 👌
okay 👌|no 🙅|thanks 🙏|thank 🙏|please 🙏|pray 🙏|clap 👏|applause 👏|strong 💪|muscle 💪|fist ✊|hand ✋|hands 🙌|point 👉
eyes 👀|look 👀|see 👀|watch ⌚|ear 👂|listen 👂|nose 👃|mouth 👄|brain 🧠|smart 🧠|idea 💡|ideas 💡|bones 🦴|tooth 🦷|foot 🦶
baby 👶|child 🧒|kid 🧒|kids 🧒|boy 👦|girl 👧|man 👨|woman 👩|people 👥|family 👪|friend 🤝|friends 🤝|deal 🤝|teacher 🧑‍🏫|student 🧑‍🎓
doctor 🧑‍⚕️|nurse 🧑‍⚕️|cook 🧑‍🍳|chef 🧑‍🍳|farmer 🧑‍🌾|police 👮|detective 🕵️|artist 🧑‍🎨|scientist 🧑‍🔬|astronaut 🧑‍🚀|king 🤴|queen 👸|ghost 👻
robot 🤖|alien 👽|monster 👾|zombie 🧟|wizard 🧙|magic ✨|fairy 🧚|angel 😇|devil 😈|skull 💀|dead 💀|clown 🤡|ninja 🥷|superhero 🦸
dog 🐶|dogs 🐕|puppy 🐶|cat 🐱|cats 🐈|kitten 🐱|mouse 🐭|rabbit 🐰|bunny 🐰|fox 🦊|bear 🐻|panda 🐼|koala 🐨|tiger 🐯|lion 🦁
cow 🐮|pig 🐷|frog 🐸|monkey 🐵|chicken 🐔|bird 🐦|birds 🐦|penguin 🐧|duck 🦆|eagle 🦅|owl 🦉|bat 🦇|wolf 🐺|horse 🐴|unicorn 🦄
bee 🐝|bug 🐛|butterfly 🦋|snail 🐌|spider 🕷️|turtle 🐢|snake 🐍|dragon 🐉|dinosaur 🦖|octopus 🐙|fish 🐟|dolphin 🐬|whale 🐳|shark 🦈|crab 🦀
elephant 🐘|giraffe 🦒|zebra 🦓|camel 🐫|sheep 🐑|goat 🐐|deer 🦌|squirrel 🐿️|hedgehog 🦔|sloth 🦥|otter 🦦|parrot 🦜|flamingo 🦩|peacock 🦚
flower 🌸|flowers 💐|rose 🌹|tulip 🌷|sunflower 🌻|tree 🌳|trees 🌲|plant 🌱|leaf 🍃|leaves 🍂|autumn 🍂|fall 🍂|cactus 🌵|mushroom 🍄
sun ☀️|sunny ☀️|moon 🌙|star ⭐|stars ✨|night 🌙|cloud ☁️|cloudy ☁️|rain 🌧️|rainy 🌧️|storm ⛈️|lightning ⚡|snow ❄️|snowman ⛄|cold 🥶
hot 🥵|fire 🔥|lit 🔥|water 💧|ocean 🌊|sea 🌊|wave 🌊|rainbow 🌈|wind 💨|tornado 🌪️|earth 🌍|world 🌍|globe 🌐|volcano 🌋|mountain ⛰️
beach 🏖️|island 🏝️|desert 🏜️|camping 🏕️|forest 🌲|apple 🍎|banana 🍌|grapes 🍇|orange 🍊|lemon 🍋|cherry 🍒|strawberry 🍓|peach 🍑|pear 🍐
watermelon 🍉|pineapple 🍍|mango 🥭|avocado 🥑|tomato 🍅|carrot 🥕|corn 🌽|potato 🥔|broccoli 🥦|pepper 🌶️|bread 🍞|cheese 🧀|egg 🥚|eggs 🥚
bacon 🥓|burger 🍔|fries 🍟|pizza 🍕|hotdog 🌭|sandwich 🥪|taco 🌮|burrito 🌯|salad 🥗|soup 🍲|pasta 🍝|spaghetti 🍝|rice 🍚|sushi 🍣
noodles 🍜|ramen 🍜|dumpling 🥟|cake 🍰|birthday 🎂|cookie 🍪|cookies 🍪|chocolate 🍫|candy 🍬|lollipop 🍭|donut 🍩|icecream 🍦|popcorn 🍿|honey 🍯
coffee ☕|tea 🍵|milk 🥛|juice 🧃|beer 🍺|wine 🍷|cocktail 🍸|food 🍽️|eat 🍽️|dinner 🍽️|lunch 🥪|breakfast 🥞|hungry 🤤|drink 🥤
house 🏠|home 🏠|building 🏢|office 🏢|school 🏫|hospital 🏥|bank 🏦|hotel 🏨|church ⛪|castle 🏰|city 🏙️|bridge 🌉|tent ⛺|factory 🏭
car 🚗|cars 🚗|taxi 🚕|bus 🚌|truck 🚚|train 🚆|bike 🚲|bicycle 🚲|motorcycle 🏍️|plane ✈️|airplane ✈️|flight ✈️|rocket 🚀|ship 🚢|boat ⛵
travel 🧳|trip 🧳|vacation 🏖️|holiday 🏖️|map 🗺️|road 🛣️|fuel ⛽|traffic 🚦|stop 🛑|phone 📱|call 📞|computer 💻|laptop 💻|keyboard ⌨️
email 📧|mail 📬|letter ✉️|message 💬|chat 💬|camera 📷|photo 📸|video 📹|movie 🎬|film 🎞️|tv 📺|music 🎵|song 🎶|guitar 🎸|piano 🎹
drum 🥁|microphone 🎤|sing 🎤|dance 💃|dancing 💃|game 🎮|games 🎮|play ▶️|dice 🎲|puzzle 🧩|art 🎨|paint 🎨|book 📖|books 📚|read 📖
write ✍️|pen 🖊️|pencil ✏️|paper 📄|notes 📝|calendar 📅|clock 🕐|time ⏰|alarm ⏰|money 💰|cash 💵|dollar 💵|rich 🤑|gift 🎁|present 🎁
shopping 🛍️|cart 🛒|key 🔑|lock 🔒|door 🚪|bed 🛏️|chair 🪑|light 💡|bulb 💡|battery 🔋|tool 🔧|tools 🛠️|hammer 🔨|gear ⚙️|science 🔬
lab 🧪|medicine 💊|pill 💊|health 🩺|bomb 💣|trophy 🏆|win 🏆|winner 🏆|medal 🏅|gold 🥇|crown 👑|diamond 💎|ring 💍|shirt 👕|dress 👗
shoes 👟|hat 🎩|glasses 👓|bag 👜|soccer ⚽|football 🏈|basketball 🏀|baseball ⚾|tennis 🎾|golf ⛳|swim 🏊|run 🏃|running 🏃|yoga 🧘
gym 🏋️|ski ⛷️|sport 🏅|sports 🏅|goal 🥅|target 🎯|check ✅|done ✅|correct ✅|wrong ❌|warning ⚠️|danger ⚠️|question ❓|new 🆕|free 🆓
up ⬆️|down ⬇️|left ⬅️|right ➡️|top 🔝|hundred 💯|perfect 💯|fast ⚡|speed 💨|slow 🐢|search 🔍|link 🔗|chart 📈|growth 📈|work 💼
job 💼|business 💼|meeting 📅|team 👥|ship 🚢|launch 🚀|bug 🐛|code 💻|data 📊|cloud ☁️|secret 🤫|quiet 🤫|loud 📢|news 📰|flag 🚩
peace ☮️|luck 🍀|lucky 🍀|christmas 🎄|halloween 🎃|pumpkin 🎃|valentine 💘|summer 🌞|winter ❄️|spring 🌷|morning 🌅|sunset 🌇|weekend 🎉|dream 💭
`;

export const EMOJI: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const pair of RAW.split(/[|\n]/)) {
    const t = pair.trim();
    if (!t) continue;
    const i = t.indexOf(" ");
    const word = t.slice(0, i).toLowerCase();
    if (!m.has(word)) m.set(word, t.slice(i + 1).trim());
  }
  return m;
})();

/** Looks up a word, then simple English plural/verb forms (dogs → dog, parties → party, dancing → dance). */
export function lookupEmoji(word: string): string | undefined {
  const w = word.toLowerCase().replace(/’/g, "'");
  const direct = EMOJI.get(w);
  if (direct) return direct;
  const tries: string[] = [];
  if (w.endsWith("ies")) tries.push(w.slice(0, -3) + "y");
  if (w.endsWith("es")) tries.push(w.slice(0, -2));
  if (w.endsWith("s")) tries.push(w.slice(0, -1));
  if (w.endsWith("ing")) tries.push(w.slice(0, -3), w.slice(0, -3) + "e");
  if (w.endsWith("ed")) tries.push(w.slice(0, -2), w.slice(0, -1));
  if (w.endsWith("'s")) tries.push(w.slice(0, -2));
  for (const t of tries) {
    const e = EMOJI.get(t);
    if (e) return e;
  }
  return undefined;
}

export function translateEmoji(text: string, mode: "after" | "replace"): { output: string; matched: number } {
  let matched = 0;
  const output = text.replace(/[\p{L}][\p{L}'’]*/gu, (word) => {
    const e = lookupEmoji(word);
    if (!e) return word;
    matched++;
    return mode === "replace" ? e : `${word} ${e}`;
  });
  return { output, matched };
}
