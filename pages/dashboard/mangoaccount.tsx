import ExplorerLink from '@components/shared/ExplorerLink'
import useMangoGroup from 'hooks/useMangoGroup'
import type { NextPage } from 'next'
import { ReactNode } from 'react'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import useMangoAccount from 'hooks/useMangoAccount'
import { toUiDecimalsForQuote, HealthType } from '@blockworks-foundation/mango-v4';

export async function getStaticProps({ locale }: { locale: string }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  }
}

const Dashboard: NextPage = () => {
  const { group } = useMangoGroup()
  // const { mangoTokens } = useJupiterMints()
  // const client = mangoStore(s => s.client)
  const { mangoAccount } = useMangoAccount()

  return (
    <div className="grid grid-cols-12">
      <div className="col-span-12 border-b border-th-bkg-3 lg:col-span-8 lg:col-start-3 xl:col-span-6 xl:col-start-4">
        <div className="p-8 pb-20 md:pb-16 lg:p-10">
          <h1>Dashboard</h1>
          {group && mangoAccount ? (
            <div className="mt-4">
              <h2 className="mb-6">Mango Account</h2>

              <KeyValuePair
                label="Address"
                value={
                  <ExplorerLink address={mangoAccount.publicKey.toString()} />
                }
              />
              <KeyValuePair
                label="Owner"
                value={<ExplorerLink address={mangoAccount.owner.toString()} />}
              />
              <KeyValuePair label="Name" value={mangoAccount.name.toString()} />
              <KeyValuePair
                label="Delegate"
                value={
                  <ExplorerLink address={mangoAccount.delegate.toString()} />
                }
              />
              <KeyValuePair
                label="Account Number"
                value={mangoAccount.accountNum.toString()}
              />
              <KeyValuePair
                label="Being Liquidated"
                value={mangoAccount.beingLiquidated.toString()}
              />
              <KeyValuePair
                label="Init Health"
                value={`$${toUiDecimalsForQuote(mangoAccount.getHealth(group, HealthType.init)).toFixed(4)}`}
              />
              <KeyValuePair
                label="Maint Health"
                value={`$${toUiDecimalsForQuote(mangoAccount.getHealth(group, HealthType.maint)).toFixed(4)}`}
              />
              <KeyValuePair
                label="Perp Settle Health"
                value={`$${toUiDecimalsForQuote(mangoAccount.getPerpSettleHealth(group)).toFixed(4)}`}
              />
              <KeyValuePair
                label="Net Deposits"
                value={`$${toUiDecimalsForQuote(mangoAccount.netDeposits).toFixed(4)}`}
              />
              <KeyValuePair
                label="Perp Spot Transfers"
                value={mangoAccount.perpSpotTransfers.toNumber()}
              />
              <KeyValuePair
                label="Health Region Begin Init Health"
                value={mangoAccount.healthRegionBeginInitHealth.toNumber()}
              />

              <h3 className="mt-4">Token Active Positions</h3>
              {mangoAccount.tokensActive().map((token) => {
                const bank = group.getFirstBankByTokenIndex(token.tokenIndex)
                return (
                  <div key={token.tokenIndex} className="mt-6">
                    <KeyValuePair label="Token's Bank Name" value={bank.name} />
                    <KeyValuePair
                      label="Balance UI"
                      value={token.balanceUi(bank)}
                    />
                    <KeyValuePair
                      label="Value at oracle price"
                      value={`$${token.balanceUi(bank) * bank.uiPrice}`}
                    />
                  </div>
                )
              })}

              <h3 className="mt-4">Serum3 Active Positions</h3>
              {mangoAccount.serum3Active().map((serum) => {
                const market = group.getSerum3MarketByMarketIndex(
                  serum.marketIndex
                )
                const extMarket = group.getSerum3ExternalMarket(
                  market.serumMarketExternal
                )
                return (
                  <div key={serum.marketIndex} className="mt-6">
                    <KeyValuePair
                      label="Serum Market"
                      value={
                        <ExplorerLink address={market.publicKey.toString()} />
                      }
                    />
                    <KeyValuePair
                      label="Serum External Market"
                      value={
                        <ExplorerLink
                          address={extMarket.publicKey.toString()}
                        />
                      }
                    />
                    <KeyValuePair label="Name" value={market.name} />
                    <KeyValuePair
                      label="Market Index"
                      value={serum.marketIndex}
                    />
                  </div>
                )
              })}

              <h3 className="mt-4">Perp Active Positions</h3>
              {mangoAccount.perpActive().map((perp) => {
                const market = group.getPerpMarketByMarketIndex(
                  perp.marketIndex
                )
                return (
                  <div key={perp.marketIndex} className="mt-6">
                    <KeyValuePair
                      label="Market"
                      value={
                        <ExplorerLink address={market.publicKey.toString()} />
                      }
                    />
                    <KeyValuePair
                      label="Market Index"
                      value={perp.marketIndex}
                    />
                    <KeyValuePair label="Name" value={market.name} />
                    <KeyValuePair
                      label="Base Position Ui"
                      value={perp.getBasePositionUi(market)}
                    />
                    <KeyValuePair
                      label="Quote Position UI"
                      value={`$${toUiDecimalsForQuote(perp.quotePositionNative).toFixed(4)}`}
                    />
                    <KeyValuePair
                      label="Quote Running Native"
                      value={perp.quoteRunningNative.toNumber()}
                    />
                    <KeyValuePair
                      label="Taker Quote Lots"
                      value={perp.takerQuoteLots.toNumber()}
                    />
                    <KeyValuePair
                      label="Unsettled Funding"
                      value={perp.getUnsettledFunding(market).toNumber()}
                    />
                    <KeyValuePair
                      label="Equity UI"
                      value={perp.getEquityUi(group, market)}
                    />
                    <KeyValuePair
                      label="Has open orders"
                      value={perp.hasOpenOrders().toString()}
                    />
                    <KeyValuePair
                      label="Avg Entry Price UI"
                      value={perp.getAverageEntryPriceUi(market)}
                    />
                    <KeyValuePair
                      label="Break even price UI"
                      value={perp.getBreakEvenPriceUi(market)}
                    />
                    <KeyValuePair
                      label="Pnl"
                      value={perp.getPnl(market).toNumber()}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            'Loading'
          )}
        </div>
      </div>
    </div>
  )
}

const KeyValuePair = ({
  label,
  value,
}: {
  label: string
  value: number | ReactNode | string
}) => {
  return (
    <div className="flex justify-between border-t border-th-bkg-3 py-4 xl:py-1.5">
      <span className="mr-4 whitespace-nowrap text-th-fgd-3">{label}</span>
      {value}
    </div>
  )
}

export default Dashboard