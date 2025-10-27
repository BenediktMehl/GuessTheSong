
export const Background = () => {
    return (
        <div className="absolute inset-0 z-0">
            <div className="absolute relative h-screen w-screen overflow-hidden bg-[#fdf6e3] inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-pink-300 rounded-full filter blur-3xl opacity-80 blob-animate-1"></div>
                <div className="absolute top-[20%] right-[-10%] w-[350px] h-[350px] bg-yellow-200 rounded-full filter blur-2xl opacity-70 blob-animate-2"></div>
                <div className="absolute bottom-[-10%] left-[10%] w-[300px] h-[300px] bg-blue-200 rounded-full filter blur-2xl opacity-70 blob-animate-3"></div>
                <div className="absolute bottom-[5%] right-[10%] w-[250px] h-[250px] bg-green-200 rounded-full filter blur-2xl opacity-80 blob-animate-4"></div>
                <div className="absolute top-[40%] left-[40%] w-[200px] h-[200px] bg-purple-200 rounded-full filter blur-2xl opacity-80 blob-animate-5"></div>
            </div>
        </div>
    );
};