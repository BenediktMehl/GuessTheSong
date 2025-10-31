// Lustige zufällige Namen für Spieler
const funnyNames = [
  "🍕 Pizza",
  "🦄 Unicorn",
  "🎸 Rockstar",
  "🍌 Banana",
  "🚀 Rocket",
  "🦖 Dino",
  "🎭 Joker",
  "🍪 Cookie",
  "🦊 Foxy",
  "🌮 Taco",
  "🎪 Clown",
  "🦈 Shark",
  "🍔 Burger",
  "🎯 Bullseye",
  "🦥 Sloth",
  "🍩 Donut",
  "🦇 Batman",
  "🌵 Cactus",
  "🎲 Lucky",
  "🦉 Owl",
  "🍉 Melon",
  "🦘 Kangaroo",
  "🎨 Artist",
  "🦩 Flamingo",
  "🍕 Pepperoni",
  "🎪 Circus",
  "🦦 Otter",
  "🍟 Fries",
  "🎸 Guitar",
  "🦜 Parrot",
  "🍰 Cake",
  "🎭 Drama",
  "🦔 Hedgehog",
  "🍭 Lollipop",
  "🎯 Dart",
  "🦛 Hippo",
  "🌶️ Spicy",
  "🎪 Funky",
  "🦚 Peacock",
  "🍇 Grape"
];

export function getRandomFunnyName(): string {
  const randomIndex = Math.floor(Math.random() * funnyNames.length);
  return funnyNames[randomIndex];
}
