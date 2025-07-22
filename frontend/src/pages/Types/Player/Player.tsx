import React, { useState } from "react";
import { Background } from "../Background";

export const Player = () => {
    const [position, setPosition] = useState<number>(-1);
    const [guesser, setGuesser] = useState<string | null>(null);

    const guessSong = () => {
        // Random position between -1 and 2
        const randomPosition = Math.floor(Math.random() * 4) - 1;
        // Random 3-digit string
        const randomPlayerName = Math.floor(100 + Math.random() * 900).toString();
        setPosition(randomPosition);
        setGuesser(randomPlayerName);
        console.log(randomPosition, randomPlayerName)
    };

    const getText = () => {
        if (position === 0) {
            return (
                <>
                    <h2 className="text-white text-l font-bold drop-shadow-md mt-4">
                        It is now your turn to
                    </h2>
                    <h1 className="text-white text-4xl font-bold drop-shadow-lg">
                        Guess The Song
                    </h1>
                </>
            );
        }

        if (guesser) {
            if (position > 0) {
                return (
                    <>
                        <h2 className="text-white text-l font-bold drop-shadow-md mt-4">
                            It is {guesser}s turn to
                        </h2>
                        <h1 className="text-white text-4xl font-bold drop-shadow-lg">
                            Guess The Song
                        </h1>
                        <h2 className="text-white text-l font-bold drop-shadow-md mt-4">
                            It is your turn after {position > 1 ? `${position} players` : "him/her"}!
                        </h2>
                    </>
                );
            }
            return (
                <>
                    <h2 className="text-white text-l font-bold drop-shadow-md mt-4">
                        It is {guesser}s turn to
                    </h2>
                    <h1 className="text-white text-4xl font-bold drop-shadow-lg">
                        Guess The Song
                    </h1>
                    <h2 className="text-white text-l font-bold drop-shadow-md mt-4">
                        Press the screen to guess next!
                    </h2>
                </>
            );
        }

        return (
            <>
                <h2 className="text-white text-l font-bold drop-shadow-md mt-4">
                    Press the screen to
                </h2>
                <h1 className="text-white text-4xl font-bold drop-shadow-lg">
                    Guess The Song
                </h1>
            </>
        );
    };

    return (
        <div
            className="relative h-screen w-screen overflow-hidden"
            onClick={guessSong}
        >
            <Background />
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
                {getText()}
            </div>
        </div>
    );
};