"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        const user = sessionStorage.getItem("user");
        if (user) {
            const parsed = JSON.parse(user);
            if (parsed.role === "admin") router.push("/admin");
            else if (parsed.role === "advisor") router.push("/advisor");
            else if (parsed.role === "watchman") router.push("/watchman");
            else router.push("/student");
        } else {
            router.push("/login");
        }
    }, [router]);

    return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
}
