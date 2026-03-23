import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: {
                    blue: "var(--primary-blue)",
                    red: "var(--primary-red)",
                    green: "var(--primary-green)",
                    orange: "var(--primary-orange)",
                },
            },
        },
    },
    plugins: [animate],
};
