import type { SVGProps } from "react";

/**
 * The gold line-art icons of the home page (mountains, shield, container ship, crystals, factory, cubes, globe). They are drawn in a 48 x 48 box
 * with a thin outline in the current text colour, so they take their colour from the surrounding text (gold on the site).
 */
function Icon(props: SVGProps<SVGSVGElement>) {
  const { children, ...rest } = props;
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const IconMountain = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 39 L18 11 L27 27 L32 19 L45 39 Z" />
    <path d="M18 11 L18 22 M12 25 L18 22 L24 29 M32 19 L32 29 M3 39 H45" />
    <path d="M9 39 L18 24 L27 39" opacity="0.55" />
  </Icon>
);

export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M24 4 L40 9.5 V22 C40 32.5 33 39.5 24 44 C15 39.5 8 32.5 8 22 V9.5 Z" />
    <path d="M16.5 23.5 L22 29 L32 17.5" />
  </Icon>
);

export const IconShip = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 32 H44 L39 40 H9 Z" />
    <path d="M11 32 V25 H19 V32 M19 32 V25 H27 V32 M27 32 V25 H35 V32 M19 25 V18 H27 V25 M27 25 V18 H35 V25" />
    <path d="M35 18 V12 H40 V32" />
    <path d="M5 45 q3 -3 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0" opacity="0.6" />
  </Icon>
);

export const IconCrystals = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M24 5 L34 17 L24 43 L14 17 Z" />
    <path d="M14 17 H34 M24 5 L19.5 17 L24 43 L28.5 17 Z" />
    <path d="M9 24 L14.5 30 L10 41 L4 32 Z M39 24 L33.5 30 L38 41 L44 32 Z" />
  </Icon>
);

export const IconFactory = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5 42 V23 L16 29 V23 L27 29 V14 H35 V42 Z" />
    <path d="M29.5 14 V7 H33 V14 M9 42 V37 H13 V42 M18 42 V35 H22 V42 M30 22 H33 M30 29 H33 M30 36 H33" />
    <path d="M36 42 H43 V30 H35" />
    <circle cx="35" cy="5" r="2" opacity="0.6" />
  </Icon>
);

/** One small isometric cube with its top-left corner at (x, y); drawn in real coordinates so its outline is as thick as the other icons'. */
const cube = (x: number, y: number) => (
  <path d={`M${x + 12} ${y + 2} L${x + 20} ${y + 6} V${y + 15} L${x + 12} ${y + 19} L${x + 4} ${y + 15} V${y + 6} Z M${x + 4} ${y + 6} L${x + 12} ${y + 10} L${x + 20} ${y + 6} M${x + 12} ${y + 10} V${y + 19}`} />
);
export const IconCubes = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    {cube(12, 3)}
    {cube(2, 20)}
    {cube(22, 20)}
  </Icon>
);

export const IconGlobe = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="24" cy="24" r="18" />
    <ellipse cx="24" cy="24" rx="7.5" ry="18" />
    <path d="M6 24 H42 M24 6 V42 M9 14 H39 M9 34 H39" />
  </Icon>
);
