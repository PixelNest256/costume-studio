import React from 'react';

const Icon = ({children, size = 20, className, ...props}) => (
    <svg
        aria-hidden="true"
        className={className}
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width={size}
        {...props}
    >
        {children}
    </svg>
);

export const PlusIcon = props => (
    <Icon {...props}>
        <path d="M12 5v14M5 12h14"/>
    </Icon>
);

export const FolderIcon = props => (
    <Icon {...props}>
        <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/>
    </Icon>
);

export const SaveIcon = props => (
    <Icon {...props}>
        <path d="M5 3h11l3 3v15H5z"/>
        <path d="M8 3v6h8V3M8 21v-7h8v7"/>
    </Icon>
);

export const HelpIcon = props => (
    <Icon {...props}>
        <circle cx="12" cy="12" r="9"/>
        <path d="M9.7 9a2.4 2.4 0 1 1 3.6 2.1c-.8.5-1.3 1-1.3 2"/>
        <path d="M12 17h.01"/>
    </Icon>
);

export const ChevronDownIcon = props => (
    <Icon {...props}>
        <path d="m6 9 6 6 6-6"/>
    </Icon>
);

export const CloseIcon = props => (
    <Icon {...props}>
        <path d="m6 6 12 12M18 6 6 18"/>
    </Icon>
);

export const TrashIcon = props => (
    <Icon {...props}>
        <path d="M4 7h16M10 11v6M14 11v6M5.5 7l.8 13h11.4l.8-13M9 7V4h6v3"/>
    </Icon>
);

export const HistoryIcon = props => (
    <Icon {...props}>
        <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/>
        <path d="M3 4v5h5"/>
        <path d="M12 8v4.5l3 1.8"/>
    </Icon>
);

export const PathIcon = props => (
    <Icon {...props}>
        <path d="M4 17c3-8 6-10 8-6s3 8 8 3"/>
        <circle cx="4" cy="17" r="1.6"/>
        <circle cx="20" cy="14" r="1.6"/>
    </Icon>
);

export const DownloadIcon = props => (
    <Icon {...props}>
        <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 20h16"/>
    </Icon>
);

export const VectorIcon = props => (
    <Icon {...props}>
        <path d="m5 19 3.5-9.5L18 6l-3.5 9.5z"/>
        <circle cx="5" cy="19" r="1.8"/>
        <circle cx="18" cy="6" r="1.8"/>
    </Icon>
);

export const BitmapIcon = props => (
    <Icon {...props}>
        <rect height="14" rx="2" width="18" x="3" y="5"/>
        <path d="m7 15 3-4 3 3 2-2 3 3"/>
        <circle cx="8" cy="9" r="1.3"/>
    </Icon>
);

export const TriangleIcon = props => (
    <Icon {...props}>
        <path d="M12 4 21 20H3z"/>
    </Icon>
);

export const ArrowRightIcon = props => (
    <Icon {...props}>
        <path d="M3 12h13M13 5l7 7-7 7"/>
    </Icon>
);

export const EllipseIcon = props => (
    <Icon {...props}>
        <ellipse cx="12" cy="12" rx="9" ry="6"/>
    </Icon>
);

export const StarIcon = props => (
    <Icon {...props}>
        <path d="m12 3.5 2.5 5.3 5.8.7-4.3 4 1.1 5.7-5.1-2.8-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z"/>
    </Icon>
);

export const RoundedRectIcon = props => (
    <Icon {...props}>
        <rect height="14" rx="3" width="18" x="3" y="5"/>
    </Icon>
);

export const PenIcon = props => (
    <Icon {...props}>
        <path d="M4 20 19.5 4.5a2.1 2.1 0 0 1 3 3L7 23l-3-3z"/>
    </Icon>
);

export const PipetteIcon = props => (
    <Icon {...props}>
        <path d="m15.5 3.5 5 5-4 4-5-5z"/>
        <path d="m12.5 6.5-8 8L8 18l8-8"/>
        <path d="m4 21 2-2"/>
    </Icon>
);

export const SlidersIcon = props => (
    <Icon {...props}>
        <path d="M4 8h9M17 8h3M4 16h5M13 16h7"/>
        <circle cx="15" cy="8" r="2"/>
        <circle cx="11" cy="16" r="2"/>
    </Icon>
);

export const PaletteIcon = props => (
    <Icon {...props}>
        <path d="M12 3a9 9 0 1 0 0 18h1.3a2.2 2.2 0 0 0 1.6-3.7 2.2 2.2 0 0 1 1.6-3.7H18a3 3 0 0 0 3-3A8 8 0 0 0 12 3z"/>
        <circle cx="7.5" cy="10" r="1"/>
        <circle cx="10" cy="6.8" r="1"/>
        <circle cx="14" cy="6.8" r="1"/>
        <circle cx="16.5" cy="10" r="1"/>
    </Icon>
);

export const BrushIcon = props => (
    <Icon {...props}>
        <path d="M14.5 4.5 19.5 9.5 10 19H5v-5z"/>
        <path d="m13 6 5 5"/>
        <path d="M5 19c0 1.7-1.3 3-3 3 1.1-.8 1.4-1.8 1.4-3z"/>
    </Icon>
);
