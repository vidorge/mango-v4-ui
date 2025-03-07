import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  Dispatch,
  SetStateAction,
  useLayoutEffect,
} from 'react'
import { ArrowsRightLeftIcon, LinkIcon } from '@heroicons/react/20/solid'
import NumberFormat, {
  NumberFormatValues,
  SourceInfo,
} from 'react-number-format'
import Decimal from 'decimal.js'
import mangoStore from '@store/mangoStore'
import { useTranslation } from 'next-i18next'
import { SIZE_INPUT_UI_KEY } from '../../utils/constants'
import useLocalStorageState from 'hooks/useLocalStorageState'
import SwapSlider from './SwapSlider'
import PercentageSelectButtons from './PercentageSelectButtons'
import {
  floorToDecimal,
  floorToDecimalSignificance,
  formatCurrencyValue,
} from 'utils/numbers'
import { withValueLimit } from './MarketSwapForm'
import ReduceInputTokenInput from './ReduceInputTokenInput'
import ReduceOutputTokenInput from './ReduceOutputTokenInput'
import { notify } from 'utils/notifications'
import * as sentry from '@sentry/nextjs'
import { isMangoError } from 'types'
import Button, { LinkButton } from '@components/shared/Button'
import Loading from '@components/shared/Loading'
import TokenLogo from '@components/shared/TokenLogo'
import InlineNotification from '@components/shared/InlineNotification'
import Select from '@components/forms/Select'
import useIpAddress from 'hooks/useIpAddress'
import { Bank } from '@blockworks-foundation/mango-v4'
import useMangoAccount from 'hooks/useMangoAccount'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAbsInputPosition } from './useTokenMax'
import useRemainingBorrowsInPeriod from 'hooks/useRemainingBorrowsInPeriod'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { SwapFormTokenListType } from './SwapFormTokenList'
import { formatTokenSymbol } from 'utils/tokens'

dayjs.extend(relativeTime)

const priceToDisplayString = (price: number | Decimal | string): string => {
  const val = floorToDecimalSignificance(price, 6)
  return val.toFixed(val.dp())
}

type LimitSwapFormProps = {
  showTokenSelect: SwapFormTokenListType
  setShowTokenSelect: Dispatch<SetStateAction<SwapFormTokenListType>>
}

type LimitSwapForm = {
  amountIn: number
  triggerPrice: string
}

type FormErrors = Partial<Record<keyof LimitSwapForm, string>>

enum OrderTypes {
  STOP_LOSS = 'trade:stop-loss',
  TAKE_PROFIT = 'trade:take-profit',
}

const ORDER_TYPES = [OrderTypes.STOP_LOSS, OrderTypes.TAKE_PROFIT]

const set = mangoStore.getState().set

export const getInputTokenBalance = (inputBank: Bank | undefined) => {
  const mangoAccount = mangoStore.getState().mangoAccount.current
  if (!inputBank || !mangoAccount) return 0
  const balance = mangoAccount.getTokenBalanceUi(inputBank)
  return balance
}

const getOutputTokenBalance = (outputBank: Bank | undefined) => {
  const mangoAccount = mangoStore.getState().mangoAccount.current
  if (!outputBank || !mangoAccount) return 0
  const balance = mangoAccount.getTokenBalanceUi(outputBank)
  return balance
}

const getOrderTypeMultiplier = (
  orderType: OrderTypes,
  flipPrices: boolean,
  reducingShort: boolean,
) => {
  if (orderType === OrderTypes.STOP_LOSS) {
    return reducingShort ? (flipPrices ? 0.9 : 1.1) : flipPrices ? 1.1 : 0.9
  } else if (orderType === OrderTypes.TAKE_PROFIT) {
    return reducingShort ? (flipPrices ? 1.1 : 0.9) : flipPrices ? 0.9 : 1.1
  } else {
    return 1
  }
}

const LimitSwapForm = ({
  showTokenSelect,
  setShowTokenSelect,
}: LimitSwapFormProps) => {
  const { t } = useTranslation(['common', 'swap', 'trade'])
  const { mangoAccountAddress } = useMangoAccount()
  const { ipAllowed, ipCountry } = useIpAddress()
  // const [triggerPrice, setTriggerPrice] = useState('')
  const [orderType, setOrderType] = useState(ORDER_TYPES[0])
  const [submitting, setSubmitting] = useState(false)
  const [swapFormSizeUi] = useLocalStorageState(SIZE_INPUT_UI_KEY, 'slider')
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const { remainingBorrowsInPeriod, timeToNextPeriod } =
    useRemainingBorrowsInPeriod(true)

  const {
    inputBank,
    outputBank,
    amountIn: amountInFormValue,
    amountOut: amountOutFormValue,
    flipPrices,
    triggerPrice,
  } = mangoStore((s) => s.swap)

  const { connected, connect } = useWallet()

  const [inputBankName, outputBankName, inputBankDecimals, outputBankDecimals] =
    useMemo(() => {
      if (!inputBank || !outputBank) return ['', '', 0, 0]
      return [
        inputBank.name,
        outputBank.name,
        inputBank.mintDecimals,
        outputBank.mintDecimals,
      ]
    }, [inputBank, outputBank])

  const amountInAsDecimal: Decimal | null = useMemo(() => {
    return Number(amountInFormValue)
      ? new Decimal(amountInFormValue)
      : new Decimal(0)
  }, [amountInFormValue])

  const setAmountInFormValue = useCallback((amountIn: string) => {
    set((s) => {
      s.swap.amountIn = amountIn
      if (!parseFloat(amountIn)) {
        s.swap.amountOut = ''
      }
    })
  }, [])

  const setAmountOutFormValue = useCallback((amountOut: string) => {
    set((s) => {
      s.swap.amountOut = amountOut
      if (!parseFloat(amountOut)) {
        s.swap.amountIn = ''
      }
    })
  }, [])

  const quotePrice = useMemo(() => {
    if (!inputBank || !outputBank) return 0
    return flipPrices
      ? outputBank.uiPrice / inputBank.uiPrice
      : inputBank.uiPrice / outputBank.uiPrice
  }, [flipPrices, inputBank, outputBank])

  const isReducingShort = useMemo(() => {
    if (!mangoAccountAddress || !inputBank) return false
    const inputBalance = getInputTokenBalance(inputBank)
    return inputBalance < 0
  }, [inputBank, mangoAccountAddress])

  // set default trigger price
  useEffect(() => {
    if (!quotePrice || triggerPrice || showTokenSelect) return
    const multiplier = getOrderTypeMultiplier(
      orderType,
      flipPrices,
      isReducingShort,
    )
    set((state) => {
      state.swap.triggerPrice = priceToDisplayString(
        new Decimal(quotePrice).mul(new Decimal(multiplier)),
      )
    })
  }, [
    flipPrices,
    isReducingShort,
    orderType,
    quotePrice,
    showTokenSelect,
    triggerPrice,
  ])

  // flip trigger price and set amount out when chart direction is flipped
  useLayoutEffect(() => {
    if (!quotePrice) return
    const multiplier = getOrderTypeMultiplier(
      orderType,
      flipPrices,
      isReducingShort,
    )
    const price = priceToDisplayString(
      new Decimal(quotePrice).mul(new Decimal(multiplier)),
    )
    set((state) => {
      state.swap.triggerPrice = price
    })
    if (amountInAsDecimal?.gt(0)) {
      const amountOut = getAmountOut(
        amountInAsDecimal.toString(),
        flipPrices,
        price,
      )
      setAmountOutFormValue(amountOut.toString())
    }
  }, [flipPrices, orderType, isReducingShort])

  const triggerPriceDifference = useMemo(() => {
    if (!quotePrice) return 0
    const triggerDifference = triggerPrice
      ? ((parseFloat(triggerPrice) - quotePrice) / quotePrice) * 100
      : 0
    return triggerDifference
  }, [quotePrice, triggerPrice])

  const handleTokenSelect = (type: SwapFormTokenListType) => {
    setShowTokenSelect(type)
    setFormErrors({})
    set((state) => {
      state.swap.triggerPrice = ''
    })
  }

  // check if the borrowed amount exceeds the net borrow limit in the current period
  const borrowExceedsLimitInPeriod = useMemo(() => {
    const mangoAccount = mangoStore.getState().mangoAccount.current
    if (!mangoAccount || !inputBank) return false

    const balance = mangoAccount.getTokenDepositsUi(inputBank)
    const remainingBalance = balance - amountInAsDecimal.toNumber()
    const borrowAmount = remainingBalance < 0 ? Math.abs(remainingBalance) : 0

    return remainingBorrowsInPeriod
      ? borrowAmount > remainingBorrowsInPeriod
      : false
  }, [
    amountInAsDecimal,
    inputBank,
    mangoAccountAddress,
    remainingBorrowsInPeriod,
  ])

  const isFormValid = useCallback(
    (form: LimitSwapForm) => {
      const invalidFields: FormErrors = {}
      setFormErrors({})
      const requiredFields: (keyof LimitSwapForm)[] = [
        'amountIn',
        'triggerPrice',
      ]
      const triggerPriceNumber = parseFloat(form.triggerPrice)
      const inputTokenBalance = getInputTokenBalance(inputBank)
      const shouldFlip = flipPrices !== isReducingShort
      for (const key of requiredFields) {
        const value = form[key] as string
        if (!value) {
          invalidFields[key] = t('settings:error-required-field')
        }
      }
      if (orderType === OrderTypes.STOP_LOSS) {
        if (shouldFlip && triggerPriceNumber <= quotePrice) {
          invalidFields.triggerPrice =
            'Trigger price must be above oracle price'
        }
        if (!shouldFlip && triggerPriceNumber >= quotePrice) {
          invalidFields.triggerPrice =
            'Trigger price must be below oracle price'
        }
      }
      if (orderType === OrderTypes.TAKE_PROFIT) {
        if (shouldFlip && triggerPriceNumber >= quotePrice) {
          invalidFields.triggerPrice =
            'Trigger price must be below oracle price'
        }
        if (!shouldFlip && triggerPriceNumber <= quotePrice) {
          invalidFields.triggerPrice =
            'Trigger price must be above oracle price'
        }
      }
      if (form.amountIn > Math.abs(inputTokenBalance)) {
        invalidFields.amountIn = t('swap:insufficient-balance', {
          symbol: inputBank?.name,
        })
      }
      if (Object.keys(invalidFields).length) {
        setFormErrors(invalidFields)
      }
      return invalidFields
    },
    [
      flipPrices,
      inputBank,
      isReducingShort,
      orderType,
      quotePrice,
      setFormErrors,
    ],
  )

  // get the out amount from the in amount and trigger or limit price
  const getAmountOut = useCallback(
    (amountIn: string, flipPrices: boolean, price: string) => {
      const amountOut = flipPrices
        ? floorToDecimal(
            parseFloat(amountIn) / parseFloat(price),
            outputBank?.mintDecimals || 0,
          )
        : floorToDecimal(
            parseFloat(amountIn) * parseFloat(price),
            outputBank?.mintDecimals || 0,
          )
      return amountOut
    },
    [outputBank],
  )

  // get the in amount from the out amount and trigger or limit price
  const getAmountIn = useCallback(
    (amountOut: string, flipPrices: boolean, price: string) => {
      const amountIn = flipPrices
        ? floorToDecimal(
            parseFloat(amountOut) * parseFloat(price),
            inputBank?.mintDecimals || 0,
          )
        : floorToDecimal(
            parseFloat(amountOut) / parseFloat(price),
            inputBank?.mintDecimals || 0,
          )
      return amountIn
    },
    [inputBank, outputBank],
  )

  const handleMax = useCallback(
    (amountIn: string) => {
      setAmountInFormValue(amountIn)
      if (parseFloat(amountIn) > 0 && triggerPrice) {
        const amountOut = getAmountOut(amountIn, flipPrices, triggerPrice)
        setAmountOutFormValue(amountOut.toString())
      }
    },
    [
      flipPrices,
      getAmountOut,
      setAmountInFormValue,
      setAmountOutFormValue,
      triggerPrice,
    ],
  )

  const handleAmountInChange = useCallback(
    (e: NumberFormatValues, info: SourceInfo) => {
      if (info.source !== 'event') return
      setFormErrors({})
      setAmountInFormValue(e.value)
      if (parseFloat(e.value) > 0 && triggerPrice) {
        const amountOut = getAmountOut(e.value, flipPrices, triggerPrice)
        setAmountOutFormValue(amountOut.toString())
      }
    },
    [
      flipPrices,
      getAmountOut,
      setAmountInFormValue,
      setAmountOutFormValue,
      setFormErrors,
      triggerPrice,
    ],
  )

  const handleAmountOutChange = useCallback(
    (e: NumberFormatValues, info: SourceInfo) => {
      if (info.source !== 'event') return
      setFormErrors({})
      setAmountOutFormValue(e.value)
      if (parseFloat(e.value) > 0 && triggerPrice) {
        const amountIn = getAmountIn(e.value, flipPrices, triggerPrice)
        setAmountInFormValue(amountIn.toString())
      }
    },
    [
      flipPrices,
      getAmountIn,
      setAmountInFormValue,
      setAmountOutFormValue,
      setFormErrors,
      triggerPrice,
    ],
  )

  const handleAmountInUi = useCallback(
    (amountIn: string) => {
      setAmountInFormValue(amountIn)
      setFormErrors({})
      if (triggerPrice) {
        const amountOut = getAmountOut(amountIn, flipPrices, triggerPrice)
        setAmountOutFormValue(amountOut.toString())
      }
    },
    [
      flipPrices,
      getAmountOut,
      setAmountInFormValue,
      setAmountOutFormValue,
      setFormErrors,
      triggerPrice,
    ],
  )

  const handleTriggerPrice = useCallback(
    (e: NumberFormatValues, info: SourceInfo) => {
      if (info.source !== 'event') return
      setFormErrors({})
      set((state) => {
        state.swap.triggerPrice = e.value
      })
      if (parseFloat(e.value) > 0 && parseFloat(amountInFormValue) > 0) {
        const amountOut = getAmountOut(amountInFormValue, flipPrices, e.value)
        setAmountOutFormValue(amountOut.toString())
      }
    },
    [amountInFormValue, flipPrices, setFormErrors],
  )

  const handlePlaceStopLoss = useCallback(async () => {
    const invalidFields = isFormValid({
      amountIn: amountInAsDecimal.toNumber(),
      triggerPrice,
    })
    if (Object.keys(invalidFields).length) {
      return
    }
    try {
      const client = mangoStore.getState().client
      const group = mangoStore.getState().group
      const actions = mangoStore.getState().actions
      const mangoAccount = mangoStore.getState().mangoAccount.current
      const inputBank = mangoStore.getState().swap.inputBank
      const outputBank = mangoStore.getState().swap.outputBank

      if (!mangoAccount || !group || !inputBank || !outputBank || !triggerPrice)
        return
      setSubmitting(true)

      const amountIn = amountInAsDecimal.toNumber()

      const isReduceLong = !isReducingShort

      try {
        let tx
        if (orderType === OrderTypes.STOP_LOSS) {
          if (isReduceLong) {
            tx = await client.tcsStopLossOnDeposit(
              group,
              mangoAccount,
              inputBank,
              outputBank,
              parseFloat(triggerPrice),
              flipPrices,
              amountIn,
              null,
              null,
            )
          } else {
            tx = await client.tcsStopLossOnBorrow(
              group,
              mangoAccount,
              outputBank,
              inputBank,
              parseFloat(triggerPrice),
              !flipPrices,
              amountIn,
              null,
              true,
              null,
            )
          }
        }
        if (orderType === OrderTypes.TAKE_PROFIT) {
          if (isReduceLong) {
            tx = await client.tcsTakeProfitOnDeposit(
              group,
              mangoAccount,
              inputBank,
              outputBank,
              parseFloat(triggerPrice),
              flipPrices,
              amountIn,
              null,
              null,
            )
          } else {
            tx = await client.tcsTakeProfitOnBorrow(
              group,
              mangoAccount,
              outputBank,
              inputBank,
              parseFloat(triggerPrice),
              !flipPrices,
              amountIn,
              null,
              true,
              null,
            )
          }
        }
        notify({
          title: 'Transaction confirmed',
          type: 'success',
          txid: tx?.signature,
          noSound: true,
        })
        actions.fetchGroup()
        await actions.reloadMangoAccount(tx?.slot)
      } catch (e) {
        console.error('onSwap error: ', e)
        sentry.captureException(e)
        if (isMangoError(e)) {
          notify({
            title: 'Transaction failed',
            description: e.message,
            txid: e?.txid,
            type: 'error',
          })
        }
      }
    } catch (e) {
      console.error('Swap error:', e)
    } finally {
      setSubmitting(false)
    }
  }, [
    flipPrices,
    orderType,
    quotePrice,
    triggerPrice,
    amountInAsDecimal,
    amountOutFormValue,
    isReducingShort,
  ])

  const orderDescription = useMemo(() => {
    if (
      !amountInFormValue ||
      !amountOutFormValue ||
      !inputBankName ||
      !outputBankName ||
      !triggerPrice
    )
      return

    const formattedInputTokenName = formatTokenSymbol(inputBankName)
    const formattedOutputTokenName = formatTokenSymbol(outputBankName)

    const quoteString = flipPrices
      ? `${formattedInputTokenName} per ${formattedOutputTokenName}`
      : `${formattedOutputTokenName} per ${formattedInputTokenName}`

    const action = isReducingShort ? t('buy') : t('sell')

    // calc borrowed amount when reducing short
    let borrowToReduceShort = 0
    if (isReducingShort && mangoAccountAddress) {
      const balance = getOutputTokenBalance(outputBank)
      if (balance >= 0 && parseFloat(amountOutFormValue) > balance) {
        const amount = new Decimal(balance)
          .sub(new Decimal(amountOutFormValue))
          .toNumber()
        borrowToReduceShort = Math.abs(amount)
      }
      if (balance < 0) {
        borrowToReduceShort = parseFloat(amountOutFormValue)
      }
    }

    // xor of two flip flags
    const shouldFlip = flipPrices !== isReducingShort
    const orderTypeString =
      orderType === OrderTypes.STOP_LOSS
        ? shouldFlip
          ? t('trade:rises-to')
          : t('trade:falls-to')
        : shouldFlip
        ? t('trade:falls-to')
        : t('trade:rises-to')

    return borrowToReduceShort
      ? t('trade:trigger-order-desc-with-borrow', {
          action: action,
          amount: floorToDecimal(amountInFormValue, inputBankDecimals),
          borrowAmount: borrowToReduceShort,
          orderType: orderTypeString,
          priceUnit: quoteString,
          quoteSymbol: formattedOutputTokenName,
          symbol: formattedInputTokenName,
          triggerPrice: priceToDisplayString(triggerPrice),
        })
      : t('trade:trigger-order-desc', {
          action: action,
          amount: floorToDecimal(amountInFormValue, inputBankDecimals),
          orderType: orderTypeString,
          priceUnit: quoteString,
          symbol: formattedInputTokenName,
          triggerPrice: priceToDisplayString(triggerPrice),
        })
  }, [
    amountInFormValue,
    amountOutFormValue,
    flipPrices,
    inputBankDecimals,
    inputBankName,
    mangoAccountAddress,
    orderType,
    outputBankDecimals,
    outputBankName,
    triggerPrice,
    isReducingShort,
  ])

  const triggerPriceSuffix = useMemo(() => {
    if (!inputBankName || !outputBankName) return
    if (flipPrices) {
      return `${inputBankName} per ${outputBankName}`
    } else {
      return `${outputBankName} per ${inputBankName}`
    }
  }, [flipPrices, inputBankName, outputBankName])

  const toggleFlipPrices = useCallback(
    (flip: boolean) => {
      if (!inputBankName || !outputBankName) return
      setFormErrors({})
      set((state) => {
        state.swap.flipPrices = flip
      })
    },
    [inputBankName, outputBankName, setFormErrors],
  )

  const handleOrderTypeChange = useCallback(
    (type: string) => {
      setFormErrors({})
      const newType = type as OrderTypes
      setOrderType(newType)
      const triggerMultiplier = getOrderTypeMultiplier(
        newType,
        flipPrices,
        isReducingShort,
      )
      const trigger = priceToDisplayString(
        quotePrice * triggerMultiplier,
      ).toString()
      set((state) => {
        state.swap.triggerPrice = trigger
      })
      if (amountInAsDecimal.gt(0)) {
        const amountOut = getAmountOut(
          amountInAsDecimal.toString(),
          flipPrices,
          trigger,
        ).toString()
        setAmountOutFormValue(amountOut)
      }
    },
    [flipPrices, quotePrice, setFormErrors, isReducingShort],
  )

  const onClick = !connected ? connect : handlePlaceStopLoss

  return (
    <>
      <ReduceInputTokenInput
        className="rounded-b-none"
        error={formErrors.amountIn}
        handleAmountInChange={handleAmountInChange}
        setShowTokenSelect={() => handleTokenSelect('reduce-input')}
        handleMax={handleMax}
        isTriggerOrder
      />
      <div className="bg-th-bkg-2 p-3 pt-0">
        {swapFormSizeUi === 'slider' ? (
          <SwapSlider
            useMargin={false}
            amount={amountInAsDecimal.toNumber()}
            onChange={(v) => handleAmountInUi(v)}
            step={1 / 10 ** (inputBankDecimals || 6)}
            maxAmount={useAbsInputPosition}
          />
        ) : (
          <div className="-mt-2">
            <PercentageSelectButtons
              amountIn={amountInAsDecimal.toString()}
              setAmountIn={(v) => handleAmountInUi(v)}
              useMargin={false}
            />
          </div>
        )}
      </div>
      <div
        className={`grid grid-cols-2 gap-2 bg-th-bkg-2 p-3 pt-1`}
        id="swap-step-two"
      >
        <div className="col-span-1">
          <p className="mb-2 text-th-fgd-2">{t('trade:order-type')}</p>
          <Select
            value={t(orderType)}
            onChange={(type) => handleOrderTypeChange(type)}
            className="w-full"
            buttonClassName="ring-transparent rounded-t-lg rounded-b-lg focus:outline-none md:hover:bg-th-bkg-1 md:hover:ring-transparent focus-visible:bg-th-bkg-3 whitespace-nowrap"
          >
            {ORDER_TYPES.map((type) => (
              <Select.Option key={type} value={type}>
                {t(type)}
              </Select.Option>
            ))}
          </Select>
        </div>
        <div className="col-span-1">
          <div className="mb-2 flex items-end justify-between">
            <p className="text-th-fgd-2">{t('trade:trigger-price')}</p>
            <p
              className={`font-mono text-xs ${
                triggerPriceDifference >= 0 ? 'text-th-up' : 'text-th-down'
              }`}
            >
              {triggerPriceDifference
                ? (triggerPriceDifference > 0 ? '+' : '') +
                  triggerPriceDifference.toFixed(2)
                : '0.00'}
              %
            </p>
          </div>
          <div className="flex items-center">
            <div className="relative w-full">
              <NumberFormat
                inputMode="decimal"
                thousandSeparator=","
                allowNegative={false}
                isNumericString={true}
                name="triggerPrice"
                id="triggerPrice"
                className="h-10 w-full rounded-lg bg-th-input-bkg p-3 pl-8 font-mono text-sm text-th-fgd-1 focus:outline-none md:hover:bg-th-bkg-1"
                placeholder="0.00"
                value={triggerPrice}
                onValueChange={handleTriggerPrice}
                isAllowed={withValueLimit}
              />
              <div className="absolute left-2 top-1/2 -translate-y-1/2">
                <TokenLogo
                  bank={flipPrices ? inputBank : outputBank}
                  size={16}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <LinkButton
              className="flex items-center text-xxs font-normal text-th-fgd-3"
              onClick={() => toggleFlipPrices(!flipPrices)}
            >
              <span className="mr-1">{triggerPriceSuffix}</span>
              <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
            </LinkButton>
          </div>
        </div>
        {formErrors.triggerPrice ? (
          <div className="col-span-2 flex justify-center">
            <InlineNotification
              type="error"
              desc={formErrors.triggerPrice}
              hideBorder
              hidePadding
            />
          </div>
        ) : null}
      </div>
      <ReduceOutputTokenInput
        handleAmountOutChange={handleAmountOutChange}
        setShowTokenSelect={() => handleTokenSelect('reduce-output')}
      />
      {orderDescription ? (
        <div className="mt-4">
          <InlineNotification desc={orderDescription} type="info" />
        </div>
      ) : null}
      {ipAllowed ? (
        <Button
          disabled={borrowExceedsLimitInPeriod}
          onClick={onClick}
          className="mb-4 mt-6 flex w-full items-center justify-center text-base"
          size="large"
        >
          {connected ? (
            submitting ? (
              <Loading />
            ) : (
              <span>{t('swap:place-limit-order')}</span>
            )
          ) : (
            <div className="flex items-center">
              <LinkIcon className="mr-2 h-5 w-5" />
              {t('connect')}
            </div>
          )}
        </Button>
      ) : (
        <Button
          disabled
          className="mb-4 mt-6 w-full leading-tight"
          size="large"
        >
          {t('country-not-allowed', {
            country: ipCountry ? `(${ipCountry})` : '',
          })}
        </Button>
      )}
      {borrowExceedsLimitInPeriod &&
      remainingBorrowsInPeriod &&
      timeToNextPeriod ? (
        <div className="mb-4">
          <InlineNotification
            type="error"
            desc={t('error-borrow-exceeds-limit', {
              remaining: formatCurrencyValue(remainingBorrowsInPeriod),
              resetTime: dayjs().to(dayjs().add(timeToNextPeriod, 'second')),
            })}
          />
        </div>
      ) : null}
    </>
  )
}

export default LimitSwapForm
