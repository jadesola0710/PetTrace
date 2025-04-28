import { FaHeart, FaUser, FaBars } from "react-icons/fa";
import { HiOutlineLocationMarker } from "react-icons/hi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import Link from "next/link";

export default function Navbar() {
  return (
    <header className="bg-white shadow-md px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/">
          <span className="text-xl font-bold text-gray-800 cursor-pointer">
            🐾PetTrace
          </span>
        </Link>
        {/* <div className="flex items-center gap-1 text-gray-600">
          <HiOutlineLocationMarker className="w-5 h-5" />
          <span>Харків</span>
        </div> */}
      </div>
      {/* <div className="flex items-center gap-6">
        <FaHeart className="cursor-pointer hover:text-orange-500" />
        <FaUser className="cursor-pointer hover:text-orange-500" />
        <FaBars className="cursor-pointer hover:text-orange-500" />
        <button className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600">
          Додати оголошення +
        </button>
      </div> */}

      <ConnectButton />
    </header>
  );
}
