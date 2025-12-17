# Responsive CSS Quick Reference Guide

## 🚀 TL;DR - Copy & Paste Patterns

### Dialog Container
```tsx
<DialogContent className="w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] md:max-w-2xl lg:max-w-3xl h-[calc(100vh-2rem)] sm:h-[calc(100vh-4rem)] md:max-h-[85vh] flex flex-col border-4 border-primary p-0">
  {/* Content */}
</DialogContent>
```

### Flex Layout Structure
```tsx
<DialogContent className="flex flex-col">
  <DialogHeader className="flex-none p-3 sm:p-4 md:p-5">
    {/* Fixed header */}
  </DialogHeader>
  
  <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-5 pb-3 sm:pb-4 md:pb-5">
    {/* Scrollable content */}
  </div>
  
  <div className="flex-none p-3 sm:p-4 md:p-5">
    {/* Fixed footer */}
  </div>
</DialogContent>
```

### Section Container
```tsx
<div className="pixel-border-thick bg-background p-3 sm:p-4 md:p-5 space-y-2 sm:space-y-3 md:space-y-4">
  {/* Section content */}
</div>
```

### Button Sizes
```tsx
// Primary
<Button className="h-10 sm:h-11 md:h-12 text-xs sm:text-sm md:text-base">

// Secondary
<Button className="h-9 sm:h-10 md:h-11 text-[10px] sm:text-xs md:text-sm">

// Small
<Button className="h-8 sm:h-9 md:h-10 text-[9px] sm:text-[10px] md:text-xs">
```

### Input Sizes
```tsx
<Input className="h-9 sm:h-10 md:h-11 text-[10px] sm:text-xs md:text-sm" />
```

### Icon Sizes
```tsx
// Large (Headers)
<Icon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12" />

// Medium (Buttons)
<Icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />

// Small (Labels)
<Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
```

### Typography Scale
```tsx
// Headers
<h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl">

// Subheaders
<h2 className="text-xs sm:text-sm md:text-base">

// Body
<p className="text-[10px] sm:text-xs md:text-sm">

// Small
<span className="text-[9px] sm:text-[10px] md:text-xs">
```

### Spacing
```tsx
// Padding
className="p-3 sm:p-4 md:p-5"

// Margin
className="m-2 sm:m-3 md:m-4"

// Gap
className="gap-2 sm:gap-3 md:gap-4"

// Space Between
className="space-y-2 sm:space-y-3 md:space-y-4"
```

### Collapsible Section
```tsx
<details className="pixel-border-thick bg-background group">
  <summary className="cursor-pointer p-2 sm:p-3 md:p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
    <Label className="text-[10px] sm:text-xs md:text-sm font-bold cursor-pointer">
      SECTION TITLE
    </Label>
    <span className="group-open:rotate-180 transition-transform">▼</span>
  </summary>
  <div className="p-2 sm:p-3 md:p-4 pt-0 space-y-2">
    {/* Content */}
  </div>
</details>
```

### Responsive Grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
  <div>Item 1</div>
  <div>Item 2</div>
  <div className="sm:col-span-2">Full Width</div>
</div>
```

## 📐 Sizing Chart

### Breakpoints
```
default:  0px - 639px   (Mobile Portrait)
sm:      640px - 767px  (Mobile Landscape/Small Tablet)
md:      768px - 1023px (Tablet)
lg:     1024px - 1279px (Desktop)
xl:     1280px+         (Wide Desktop)
```

### Heights
```
h-8   = 32px    h-9   = 36px    h-10  = 40px
h-11  = 44px    h-12  = 48px    h-14  = 56px
h-16  = 64px
```

### Widths
```
w-8   = 32px    w-9   = 36px    w-10  = 40px
w-11  = 44px    w-12  = 48px    w-14  = 56px
w-16  = 64px
```

### Padding/Margin
```
p-1  = 4px     p-2  = 8px      p-3  = 12px
p-4  = 16px    p-5  = 20px     p-6  = 24px
```

### Gap/Space
```
gap-1    = 4px      gap-2    = 8px      gap-3    = 12px
gap-4    = 16px     gap-1.5  = 6px      gap-2.5  = 10px
```

### Font Sizes
```
text-[9px]  = 9px      text-[10px] = 10px     text-xs  = 12px
text-sm     = 14px     text-base   = 16px     text-lg  = 18px
text-xl     = 20px     text-2xl    = 24px     text-3xl = 30px
```

## 🎯 Common Patterns

### Form Field
```tsx
<div className="space-y-1 sm:space-y-1.5">
  <Label className="text-[10px] sm:text-xs md:text-sm font-semibold">
    FIELD LABEL
  </Label>
  <Input 
    className="h-9 sm:h-10 md:h-11 text-[10px] sm:text-xs md:text-sm"
    placeholder="Enter value"
  />
</div>
```

### Info Box
```tsx
<div className="pixel-border bg-primary/10 border-primary/30 p-2 sm:p-3 md:p-4">
  <div className="flex items-start gap-1.5 sm:gap-2">
    <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
    <div className="space-y-0.5 sm:space-y-1">
      <p className="text-[10px] sm:text-xs font-bold">TITLE</p>
      <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground">
        Description text here
      </p>
    </div>
  </div>
</div>
```

### Button Group
```tsx
<div className="flex gap-1.5 sm:gap-2 md:gap-3">
  <Button className="flex-1 h-9 sm:h-10 md:h-11 text-xs sm:text-sm">
    Option 1
  </Button>
  <Button className="flex-1 h-9 sm:h-10 md:h-11 text-xs sm:text-sm">
    Option 2
  </Button>
</div>
```

### Card with Header
```tsx
<div className="pixel-border-thick bg-gradient-to-br from-primary/5 to-primary/10 p-3 sm:p-4 md:p-5 space-y-2 sm:space-y-3">
  <div className="flex items-center justify-between gap-2">
    <Label className="text-xs sm:text-sm md:text-base font-bold">
      CARD TITLE
    </Label>
    <Button variant="ghost" size="sm" className="h-8 px-2">
      Action
    </Button>
  </div>
  <div className="space-y-2">
    {/* Card content */}
  </div>
</div>
```

### Large Number Display
```tsx
<div className="space-y-1">
  <div className="flex items-baseline gap-1.5 sm:gap-2">
    <div className="text-2xl sm:text-3xl md:text-4xl font-bold truncate">
      1000.000
    </div>
    <div className="text-sm sm:text-base md:text-lg font-semibold shrink-0">
      KTA
    </div>
  </div>
  <div className="text-xs sm:text-sm md:text-base text-muted-foreground">
    $1,234.56
  </div>
</div>
```

## 🛠️ Utility Classes

### Layout
```css
flex flex-col        /* Vertical flex */
flex flex-row        /* Horizontal flex */
grid grid-cols-2     /* 2-column grid */
flex-1              /* Grow to fill */
flex-none           /* Don't grow/shrink */
shrink-0            /* Don't shrink */
```

### Overflow
```css
overflow-hidden     /* Hide overflow */
overflow-y-auto     /* Vertical scroll */
overflow-x-hidden   /* Hide horizontal */
truncate           /* Text ellipsis */
break-all          /* Break long words */
```

### Positioning
```css
relative           /* Relative positioning */
absolute           /* Absolute positioning */
fixed              /* Fixed positioning */
sticky             /* Sticky positioning */
inset-0            /* All sides = 0 */
```

### Spacing
```css
space-y-2          /* Vertical spacing */
space-x-2          /* Horizontal spacing */
gap-2              /* Gap between items */
p-2                /* Padding all sides */
px-2               /* Horizontal padding */
py-2               /* Vertical padding */
m-2                /* Margin all sides */
```

### Sizing
```css
w-full             /* Width 100% */
h-full             /* Height 100% */
max-w-full         /* Max width 100% */
min-w-0            /* Min width 0 */
w-[200px]          /* Custom width */
```

### Display
```css
block              /* Block display */
inline-block       /* Inline block */
inline             /* Inline display */
hidden             /* Display none */
```

## 💡 Pro Tips

### 1. Always Mobile First
```tsx
// ✅ Good
className="text-xs sm:text-sm md:text-base"

// ❌ Bad
className="text-base md:text-sm sm:text-xs"
```

### 2. Use Calc for Viewport-Based Sizes
```tsx
// ✅ Good - Accounts for margins
className="w-[calc(100vw-2rem)]"

// ❌ Bad - Can cause horizontal scroll
className="w-screen"
```

### 3. Consistent Spacing Scale
```tsx
// ✅ Good - Systematic progression
className="p-2 sm:p-3 md:p-4 lg:p-5"

// ❌ Bad - Random jumps
className="p-2 sm:p-5 md:p-3 lg:p-8"
```

### 4. Don't Forget About Icons
```tsx
// ✅ Good - Icons scale too
<Icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />

// ❌ Bad - Fixed size
<Icon className="w-5 h-5" />
```

### 5. Use Flex-None for Fixed Sections
```tsx
// ✅ Good - Header won't shrink
<Header className="flex-none">

// ❌ Bad - Might get squished
<Header className="flex">
```

### 6. Collapsible for Space-Saving
```tsx
// ✅ Good - Saves mobile space
<details>
  <summary>Options</summary>
  {/* Content */}
</details>

// ❌ Bad - Always takes space
<div>
  <div>Options</div>
  {/* Content always visible */}
</div>
```

## 🎨 Color & Theme

### Background Variants
```tsx
bg-background        /* Base background */
bg-card             /* Card background */
bg-muted            /* Muted background */
bg-primary          /* Primary color */
bg-secondary        /* Secondary color */
bg-accent           /* Accent color */
bg-destructive      /* Error/delete color */
```

### Text Colors
```tsx
text-foreground      /* Base text */
text-muted-foreground /* Muted text */
text-primary        /* Primary text */
text-accent         /* Accent text */
text-destructive    /* Error text */
```

### Opacity
```tsx
bg-primary/10       /* 10% opacity */
bg-primary/20       /* 20% opacity */
bg-primary/50       /* 50% opacity */
text-white/80       /* 80% opacity */
```

## 🔍 Debug Helpers

### See Borders
```tsx
// Add temporarily to see layout
className="border-2 border-red-500"
```

### See Spacing
```tsx
// Add temporarily to see padding
className="bg-red-100"
```

### Check Overflow
```tsx
// Add temporarily to see scroll
className="overflow-y-scroll"
```

## 📋 Checklist for New Components

- [ ] Mobile-first approach (no prefix first)
- [ ] Responsive font sizes (3+ breakpoints)
- [ ] Responsive spacing (3+ breakpoints)
- [ ] Proper flex/grid structure
- [ ] Overflow handling
- [ ] Touch targets (32px+ mobile)
- [ ] Readable text (9px+ minimum)
- [ ] Collapsible for mobile (if needed)
- [ ] Test on all breakpoints
- [ ] No horizontal scroll

## 🎯 Common Mistakes to Avoid

### ❌ Don't Do This
```tsx
// Fixed sizes
className="w-[400px] h-[300px]"

// Desktop-first
className="text-lg md:text-base sm:text-sm"

// No mobile consideration
className="px-20 py-10"

// Inconsistent scaling
className="p-2 sm:p-8 md:p-3"

// No overflow handling
className="max-h-[500px]"
```

### ✅ Do This Instead
```tsx
// Responsive sizes
className="w-full sm:w-[400px] md:w-[500px]"

// Mobile-first
className="text-sm md:text-base lg:text-lg"

// Mobile-friendly spacing
className="px-3 sm:px-6 md:px-10"

// Systematic scaling
className="p-2 sm:p-3 md:p-4 lg:p-5"

// Proper overflow
className="max-h-[500px] overflow-y-auto"
```

---

**Keep this reference handy when building new components! 🚀**

