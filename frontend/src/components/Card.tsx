import type { ReactNode } from "react";

const cx = (...classes: Array<string | false | undefined | null>) =>
    classes.filter(Boolean).join(" ");

type CardProps = {
    title?: ReactNode;
    subtitle?: ReactNode;
    header?: ReactNode;
    actions?: ReactNode;
    footer?: ReactNode;
    className?: string;
    bodyClassName?: string;
    headerClassName?: string;
    footerClassName?: string;
    children: ReactNode;
};

const baseClassName =
    "card bg-white/75 backdrop-blur-lg border border-white/20 shadow-2xl rounded-3xl p-6 text-base-content transition-transform duration-200";
const baseBodyClassName = "flex flex-col gap-4";

export function Card({
    title,
    subtitle,
    header,
    actions,
    footer,
    className,
    bodyClassName,
    headerClassName,
    footerClassName,
    children,
}: CardProps) {
    const hasHeading = Boolean(title || subtitle || actions || header);

    return (
        <div className={cx(baseClassName, className)}>
            {header ? (
                <div className={cx("mb-4", headerClassName)}>{header}</div>
            ) : hasHeading ? (
                <div className={cx("mb-4 flex items-start justify-between gap-3", headerClassName)}>
                    <div className="space-y-1">
                        {title &&
                            (typeof title === "string" ? (
                                <h3 className="text-xl font-semibold text-primary">{title}</h3>
                            ) : (
                                title
                            ))}
                        {subtitle &&
                            (typeof subtitle === "string" ? (
                                <p className="text-sm text-base-content/70">{subtitle}</p>
                            ) : (
                                subtitle
                            ))}
                    </div>
                    {actions}
                </div>
            ) : null}

            <div className={cx(baseBodyClassName, bodyClassName)}>{children}</div>

            {footer ? <div className={cx("mt-4", footerClassName)}>{footer}</div> : null}
        </div>
    );
}
