import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {},
    },
    plugins: [require("daisyui")],
    daisyui: {
        themes: ["light"],
        darkTheme: "light",
        base: true,
        styled: true,
        utils: true,
        logs: false,
    },
};

export default config;