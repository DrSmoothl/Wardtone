import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ReactElement,
  type ComponentProps,
  type CSSProperties,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as ScrollPrimitive from "@radix-ui/react-scroll-area";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Info,
  X,
  AudioLines,
  LoaderCircle,
  Check,
  Minus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from "lucide-react";
import appIcon from "../assets/icon.png";

export function UIProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={450} skipDelayDuration={100}>
      {children}
    </Tooltip.Provider>
  );
}
export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  title,
  ...props
}: ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
  size?: "sm" | "md" | "lg";
}) {
  const button = (
    <button
      type="button"
      {...props}
      className={`button button-${variant} button-${size} ${className}`}
    >
      {children}
    </button>
  );
  const tip =
    title ??
    (className.includes("icon-button") ? props["aria-label"] : undefined);
  return tip ? (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={6}>
          {tip}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  ) : (
    button
  );
}
export function Hint({
  text,
  children,
}: {
  text: string;
  children: ReactElement;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild tabIndex={0}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={6}>
          {text}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
export function Help({
  children,
  label = "查看说明",
}: {
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    pinned = useRef(false),
    opening = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    id = useId();
  const enter = () => {
    clearTimeout(closing.current);
    if (!open) opening.current = setTimeout(() => setOpen(true), 450);
  };
  const leave = () => {
    clearTimeout(opening.current);
    if (!pinned.current)
      closing.current = setTimeout(() => setOpen(false), 150);
  };
  const change = (value: boolean) => {
    clearTimeout(opening.current);
    clearTimeout(closing.current);
    pinned.current = value;
    setOpen(value);
  };
  useEffect(
    () => () => {
      clearTimeout(opening.current);
      clearTimeout(closing.current);
    },
    [],
  );
  return (
    <Popover.Root open={open} onOpenChange={change}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="help-button"
          aria-label={label}
          aria-describedby={id}
          onPointerEnter={enter}
          onPointerLeave={leave}
          onClick={(event) => {
            if (open && !pinned.current) {
              event.preventDefault();
              pinned.current = true;
            }
          }}
        >
          <Info />
        </button>
      </Popover.Trigger>
      <span id={id} className="sr-only">
        {children}
      </span>
      <Popover.Portal>
        <Popover.Content
          className="help-content"
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onPointerEnter={() => clearTimeout(closing.current)}
          onPointerLeave={leave}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function Select({
  children,
  value,
  onValueChange,
  disabled,
  id,
  "aria-label": label,
  className = "",
  placeholder = "选择…",
}: {
  children: ReactNode;
  value: string | number;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
  placeholder?: string;
}) {
  const items = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const p = child.props as {
        value: string | number;
        children: ReactNode;
        disabled?: boolean;
      };
      return {
        value: String(p.value),
        label: p.children,
        disabled: p.disabled,
      };
    });
  return (
    <SelectPrimitive.Root
      value={"v:" + value}
      onValueChange={(v) => onValueChange(v.slice(2))}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={label}
        className={"select-trigger " + className}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="select-menu"
          position="popper"
          sideOffset={5}
          collisionPadding={12}
        >
          <SelectPrimitive.ScrollUpButton className="select-scroll">
            <ChevronUp />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport>
            {items.map((item) => (
              <SelectPrimitive.Item
                key={item.value}
                value={"v:" + item.value}
                disabled={item.disabled}
                className="select-item"
              >
                <SelectPrimitive.ItemText>
                  {item.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Check />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="select-scroll">
            <ChevronDown />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  id,
  "aria-label": label,
}: {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label": string;
}) {
  return (
    <CheckboxPrimitive.Root
      className="checkbox"
      id={id}
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      disabled={disabled}
      aria-label={label}
    >
      <CheckboxPrimitive.Indicator>
        {checked === "indeterminate" ? <Minus /> : <Check />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  "aria-label": label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <SwitchPrimitive.Root
      className="switch"
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
    >
      <SwitchPrimitive.Thumb className="switch-thumb" />
    </SwitchPrimitive.Root>
  );
}
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  label,
  className = "",
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <SliderPrimitive.Root
      className={"slider " + className}
      value={[value]}
      onValueChange={(values) => onValueChange(values[0])}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
    >
      <SliderPrimitive.Track className="slider-track">
        <SliderPrimitive.Range className="slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="slider-thumb" aria-label={label} />
    </SliderPrimitive.Root>
  );
}
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  disabled = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
  disabled?: boolean;
}) {
  const active = options.findIndex((option) => option.value === value);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="segmented"
      style={
        { "--segments": options.length, "--selected": active } as CSSProperties
      }
    >
      <span className="segment-thumb" aria-hidden="true" />
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={index === active ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : (index +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      options.length) %
                    options.length;
            onChange(options[next].value);
            (
              event.currentTarget.parentElement?.querySelectorAll("button")[
                next
              ] as HTMLButtonElement
            ).focus();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
export function ScrollArea({
  children,
  className = "",
  viewportClassName = "",
}: {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
}) {
  return (
    <ScrollPrimitive.Root
      className={"scroll-area " + className}
      type="hover"
      scrollHideDelay={800}
    >
      <ScrollPrimitive.Viewport
        className={"scroll-viewport " + viewportClassName}
      >
        {children}
      </ScrollPrimitive.Viewport>
      <ScrollPrimitive.Scrollbar className="scrollbar" orientation="vertical">
        <ScrollPrimitive.Thumb className="scrollbar-thumb" />
      </ScrollPrimitive.Scrollbar>
      <ScrollPrimitive.Scrollbar className="scrollbar" orientation="horizontal">
        <ScrollPrimitive.Thumb className="scrollbar-thumb" />
      </ScrollPrimitive.Scrollbar>
      <ScrollPrimitive.Corner />
    </ScrollPrimitive.Root>
  );
}
export function Disclosure({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false),
    id = useId();
  return (
    <div className="disclosure">
      <button
        type="button"
        className="disclosure-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={open ? "expanded" : ""} />
        {title}
      </button>
      {open && (
        <div id={id} className="disclosure-content">
          {children}
        </div>
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  open,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  wide?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          ref={contentRef}
          tabIndex={-1}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
          className={"dialog " + (wide ? "wide" : "")}
          aria-describedby={undefined}
        >
          <header>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" className="icon-button" aria-label="关闭">
                <X />
              </Button>
            </Dialog.Close>
          </header>
          <ScrollArea className="dialog-scroll">{children}</ScrollArea>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={"brand " + (small ? "small" : "")}>
      <img src={appIcon} alt="" />
      <span>
        戍声<small>Wardtone</small>
      </span>
    </div>
  );
}
export function Spinner() {
  return <LoaderCircle className="spin" aria-hidden="true" />;
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <AudioLines aria-hidden="true" />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action && <div className="actions">{action}</div>}
    </div>
  );
}
