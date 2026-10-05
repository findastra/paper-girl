import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Paper Girl — Your daily science rabbit hole",description:"Discover real scientific papers, free plain-language explanations, and a little illustrated curiosity.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
