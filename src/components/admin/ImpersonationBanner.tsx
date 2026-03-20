export default function ImpersonationBanner(props: any) {
  return props.tenantName ? <div className="bg-amber-500/10 border-b border-amber-200 px-4 py-2 text-sm text-amber-700">Viewing as: {props.tenantName}</div> : null;
}
