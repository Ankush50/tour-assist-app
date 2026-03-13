import React, { useEffect, useState } from "react";
import {
  Camera,
  Map,
  Compass,
  Utensils,
  Coffee,
  Pizza,
  Plane,
  Palmtree,
  Sun,
  Music,
} from "lucide-react";

const DOODLES = [
  { Icon: Camera, top: "10%", left: "5%" },
  { Icon: Map, top: "25%", left: "85%" },
  { Icon: Compass, top: "50%", left: "10%" },
  { Icon: Utensils, top: "75%", left: "80%" },
  { Icon: Coffee, top: "90%", left: "15%" },
  { Icon: Pizza, top: "15%", left: "60%" },
  { Icon: Plane, top: "40%", left: "40%" },
  { Icon: Palmtree, top: "60%", left: "90%" },
  { Icon: Sun, top: "80%", left: "50%" },
  { Icon: Music, top: "30%", left: "20%" },
];

const BackgroundDoodles = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-pink-50 to-amber-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 opacity-80 decoration-slice"></div>

      {/* Animated Doodles */}
      {DOODLES.map(({ Icon, top, left }, index) => {
        // Compute deterministic but varied animation properties
        const duration = 15 + (index % 5) * 5;
        const delay = -index * 3;
        const rotate =
          index % 2 === 0
            ? "animate-[spin_20s_linear_infinite]"
            : "animate-[bounce_8s_ease-in-out_infinite]";

        return (
          <div
            key={index}
            className="absolute text-primary/10 dark:text-gray-300/10 mix-blend-multiply dark:mix-blend-screen"
            style={{
              top,
              left,
              animation: `float ${duration}s ease-in-out ${delay}s infinite alternate`,
            }}
          >
            <div className={rotate}>
              <Icon
                size={index % 3 === 0 ? 120 : index % 2 === 0 ? 80 : 160}
                strokeWidth={1}
              />
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes float {
          0% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-40px) translateX(20px); }
          100% { transform: translateY(20px) translateX(-30px); }
        }
      `}</style>
    </div>
  );
};

export default BackgroundDoodles;
