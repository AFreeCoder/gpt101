import {
  CUSTOMER_SUPPORT_LABEL,
  CUSTOMER_SUPPORT_LABEL_EN,
  CUSTOMER_SUPPORT_URL,
} from '@/shared/lib/customer-support';

const CUSTOMER_SUPPORT_LABEL_PATTERN = /(联系客服|Contact support)/gi;

export function CustomerSupportText({ children }: { children: string }) {
  return (
    <>
      {children.split(CUSTOMER_SUPPORT_LABEL_PATTERN).map((part, index) => {
        const isCustomerSupportLabel =
          part === CUSTOMER_SUPPORT_LABEL ||
          part.toLowerCase() === CUSTOMER_SUPPORT_LABEL_EN.toLowerCase();

        if (!isCustomerSupportLabel) {
          return part;
        }

        return (
          <a
            key={`${part}-${index}`}
            href={CUSTOMER_SUPPORT_URL}
            className="text-primary font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {part}
          </a>
        );
      })}
    </>
  );
}
