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

      <ConnectButton />
    </header>
  );
}
