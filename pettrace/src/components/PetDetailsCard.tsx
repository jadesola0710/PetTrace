import { FaHeart } from "react-icons/fa";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

const thumbnails = [
  "/images/pet.jpg",
  "/images/pet2.jpg",
  "/images/pet3.jpg",
  "/images/pet4.jpg",
];

export default function PetDetails() {
  return (
    <div className="flex flex-col md:flex-row gap-8 p-4 md:p-8 max-w-7xl mx-auto">
      {/* ===== Left: Image + Gallery ===== */}
      <div className="md:w-1/2 flex flex-col items-center">
        {/* MAIN IMAGE */}
        <div className="relative w-full md:h-[460px] h-[300px] overflow-hidden rounded-2xl">
          <img
            src="/images/pet.jpg"
            alt="Kapuchina"
            className="object-cover w-full h-full"
          />

          {/* Desktop Nav Buttons */}
          <button className="hidden md:flex absolute top-1/2 left-2 -translate-y-1/2 bg-white p-2 rounded-full shadow">
            <FaChevronLeft />
          </button>
          <button className="hidden md:flex absolute top-1/2 right-2 -translate-y-1/2 bg-white p-2 rounded-full shadow">
            <FaChevronRight />
          </button>

          {/* Carousel dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
            {thumbnails.map((_, i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-white opacity-70"
              ></span>
            ))}
          </div>
        </div>

        {/* Thumbnail strip (desktop only) */}
        <div className="hidden md:flex mt-4 gap-3">
          {thumbnails.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`thumbnail-${i}`}
              className={`w-20 h-20 rounded-xl object-cover border-2 ${
                i === 0 ? "border-indigo-500" : "border-transparent"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ===== Right: Pet Details ===== */}
      <div className="md:w-1/2 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Капучина</h1>
            <p className="text-gray-500 text-sm">
              Терьєр • Загубилась 24 квіт., 17:00
            </p>
          </div>
          <FaHeart className="text-purple-400 text-xl mt-1" />
        </div>

        {/* Gender, Size, Age */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-indigo-50 text-center rounded-xl py-2 text-sm font-medium text-indigo-600">
            Стать <br />
            <span className="font-semibold">дівчинка</span>
          </div>
          <div className="bg-indigo-50 text-center rounded-xl py-2 text-sm font-medium text-indigo-600">
            Розмір <br />
            <span className="font-semibold">56 см</span>
          </div>
          <div className="bg-indigo-50 text-center rounded-xl py-2 text-sm font-medium text-indigo-600">
            Вік <br />
            <span className="font-semibold">11 міс</span>
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="font-semibold mb-1">Деталі:</h3>
          <p className="text-sm text-gray-700">
            Наша Капучина невеликого розміру, коричневого кольору зі світлим
            пузиком. Мала червоний нашийник. Загубилася в центрі міста Бровари,
            недалеко від головної площі міста.
          </p>
        </div>

        {/* Contact Info */}
        <div>
          <h3 className="font-semibold mb-1">Контакти власника:</h3>
          <p className="text-sm leading-relaxed">
            <strong>Ім’я:</strong> Ярослав <br />
            <strong>Телефон:</strong> +38 (099) 999 99 99 <br />
            <strong>Email:</strong> yaroslavhelp@gmail.com
          </p>
        </div>

        {/* Location + Map */}
        <div className="rounded-2xl shadow overflow-hidden">
          <iframe
            src="https://www.google.com/maps?q=вул.+Незалежності+7,+Бориспіль&output=embed"
            className="w-full h-40 border-0"
            loading="lazy"
          ></iframe>
          <div className="p-3 text-sm">
            <p>
              <strong>м. Бориспіль, вул. Незалежності 7</strong> <br />
              Київська обл.
            </p>
            <p className="text-gray-500 mt-1 text-xs">за 168 км від вас</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col md:flex-row gap-4 mt-4">
          <button className="bg-indigo-600 text-white px-6 py-2 rounded-xl shadow hover:bg-indigo-700">
            Мої оголошення
          </button>
          <button className="border border-gray-300 px-6 py-2 rounded-xl hover:bg-gray-50">
            Всі оголошення
          </button>
        </div>
      </div>
    </div>
  );
}
