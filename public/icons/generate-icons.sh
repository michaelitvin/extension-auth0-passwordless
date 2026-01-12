#!/bin/bash
# Generate simple placeholder icons using ImageMagick if available
# Otherwise creates placeholder files

create_svg() {
  local size=$1
  cat > "icon${size}.svg" << SVGEOF
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="$((size/8))" fill="#635bff"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="$((size*45/100))" font-weight="bold">A0</text>
</svg>
SVGEOF
}

cd "$(dirname "$0")"

# Create SVG icons
create_svg 16
create_svg 48
create_svg 128

echo "Created SVG placeholder icons"
