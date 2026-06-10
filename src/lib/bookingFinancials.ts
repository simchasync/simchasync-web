export const isTravelFeeChargedToCustomer = (feeType: string | null | undefined) => feeType === "charge_customer";

/** What the customer owes in total: the booking price plus the travel fee, if it's billed to the customer. */
export const getEffectiveTotal = (totalPrice: number, travelFee: number, travelFeeType: string | null | undefined) =>
  totalPrice + (isTravelFeeChargedToCustomer(travelFeeType) ? travelFee : 0);

export const computeBalanceDue = (totalPrice: number, deposit: number, travelFee: number, travelFeeType: string | null | undefined) =>
  Math.max(getEffectiveTotal(totalPrice, travelFee, travelFeeType) - deposit, 0);
