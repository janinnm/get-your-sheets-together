"use client";

import dynamic from "next/dynamic";
import { costs, listings } from "../lib/data";

const Explorer = dynamic(() => import("../components/Explorer"), {
  ssr: false,
  loading: () => <p className="p-8 text-gray-500">Loading map…</p>,
});

export default function Home() {
  return <Explorer costs={costs} listings={listings} />;
}
