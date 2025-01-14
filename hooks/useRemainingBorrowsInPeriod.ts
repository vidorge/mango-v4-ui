import mangoStore from '@store/mangoStore'
import { useMemo } from 'react'
import useSelectedMarket from './useSelectedMarket'
import {
  I80F48,
  Serum3Market,
  toUiDecimals,
  toUiDecimalsForQuote,
} from '@blockworks-foundation/mango-v4'

export default function useRemainingBorrowsInPeriod(isSwap?: boolean) {
  const { selectedMarket } = useSelectedMarket()
  const { inputBank } = mangoStore((s) => s.swap)
  const { side } = mangoStore((s) => s.tradeForm)

  const bank = useMemo(() => {
    if (isSwap && inputBank) {
      return inputBank
    } else {
      if (selectedMarket instanceof Serum3Market) {
        const group = mangoStore.getState().group
        let balanceBank
        if (side === 'buy') {
          balanceBank = group?.getFirstBankByTokenIndex(
            selectedMarket.baseTokenIndex,
          )
        } else {
          balanceBank = group?.getFirstBankByTokenIndex(
            selectedMarket.quoteTokenIndex,
          )
        }
        return balanceBank
      }
    }
    return
  }, [inputBank, isSwap, selectedMarket, side])

  const [remainingBorrowsInPeriod, timeToNextPeriod] = useMemo(() => {
    if (!bank) return [undefined, undefined]
    const borrowsInPeriod = toUiDecimalsForQuote(
      I80F48.fromI64(bank.netBorrowsInWindow).mul(bank.price),
    )
    const borrowLimit = toUiDecimals(bank.netBorrowLimitPerWindowQuote, 6)
    const remainingBorrows = borrowLimit - borrowsInPeriod
    const timeToNextPeriod = bank.getTimeToNextBorrowLimitWindowStartsTs()
    return [remainingBorrows, timeToNextPeriod]
  }, [bank])

  return { remainingBorrowsInPeriod, timeToNextPeriod }
}
