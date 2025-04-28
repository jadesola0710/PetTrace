import Image from "next/image";

export default function HeroBanner() {
  return (
    <section className="relative w-full bg-pink-100 rounded-3xl p-6 md:p-10 overflow-hidden flex flex-col md:flex-row mt-6 items-center justify-between">
      {/* Background Shape */}
      <div className="hidden md:block absolute -right-40 top-0 w-[50%] h-full bg-pink-200 rounded-l-full -z-10" />

      {/* Text Section */}
      <div className="text-center md:text-left md:max-w-md z-10">
        <h4 className="text-2xl md:text-4xl font-bold text-gray-800 leading-tight">
          Never Lose a Furry Friend Again
          {/* <br className="hidden md:block" /> PetTrace Brings Them Home. */}
        </h4>
        {/* <h5> PetTrace Brings Them Home</h5> */}
        <p className="text-gray-700 mt-2 text-base md:text-lg">
          Powered by Celo Blockchain
        </p>
      </div>

      {/* Dog Image */}
      <div className="mt-6 md:mt-0 z-10">
        <Image
          src="/pets.jpg"
          alt="Сократ"
          width={250}
          height={250}
          className="object-contain"
        />
      </div>
    </section>
  );
}
