import { forwardRef } from "react";
const InvoicePreview = forwardRef<HTMLDivElement, any>((props, ref) => { return <div ref={ref} />; });
InvoicePreview.displayName = 'InvoicePreview';
export default InvoicePreview;
