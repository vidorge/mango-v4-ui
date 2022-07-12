import { FunctionComponent, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import useDimensions from 'react-cool-dimensions'
import LineChartIcon from '../icons/LineChartIcon'
import ContentBox from '../shared/ContentBox'

dayjs.extend(relativeTime)

interface SwapTokenChartProps {
  inputTokenId?: string
  outputTokenId?: string
}

export const numberFormatter = Intl.NumberFormat('en', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 5,
})

export const numberCompacter = Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 2,
})

const SwapTokenChart: FunctionComponent<SwapTokenChartProps> = ({
  inputTokenId,
  outputTokenId,
}) => {
  const [chartData, setChartData] = useState([])
  const [hideChart, setHideChart] = useState(false)
  const [baseTokenId, setBaseTokenId] = useState('')
  const [quoteTokenId, setQuoteTokenId] = useState('')
  const [inputTokenInfo, setInputTokenInfo] = useState<any>(null)
  const [outputTokenInfo, setOutputTokenInfo] = useState<any>(null)
  const [mouseData, setMouseData] = useState<any>(null)
  const [daysToShow, setDaysToShow] = useState(1)
  const { observe, width, height } = useDimensions()

  const handleMouseMove = (coords: any) => {
    if (coords.activePayload) {
      setMouseData(coords.activePayload[0].payload)
    }
  }

  const handleMouseLeave = () => {
    setMouseData(null)
  }

  useEffect(() => {
    if (!inputTokenId || !outputTokenId) {
      return
    }
    if (['usd-coin', 'tether'].includes(inputTokenId)) {
      setBaseTokenId(outputTokenId)
      setQuoteTokenId(inputTokenId)
    } else {
      setBaseTokenId(inputTokenId)
      setQuoteTokenId(outputTokenId)
    }
  }, [inputTokenId, outputTokenId])

  // Use ohlc data

  const getChartData = async () => {
    const inputResponse = await fetch(
      `https://api.coingecko.com/api/v3/coins/${baseTokenId}/ohlc?vs_currency=usd&days=${daysToShow}`
    )
    const outputResponse = await fetch(
      `https://api.coingecko.com/api/v3/coins/${quoteTokenId}/ohlc?vs_currency=usd&days=${daysToShow}`
    )
    const inputData = await inputResponse.json()
    const outputData = await outputResponse.json()

    let data: any[] = []
    if (Array.isArray(inputData)) {
      data = data.concat(inputData)
    }
    if (Array.isArray(outputData)) {
      data = data.concat(outputData)
    }

    const formattedData = data.reduce((a, c) => {
      const found = a.find((price: any) => price.time === c[0])
      if (found) {
        if (['usd-coin', 'tether'].includes(quoteTokenId)) {
          found.price = found.inputPrice / c[4]
        } else {
          found.price = c[4] / found.inputPrice
        }
      } else {
        a.push({ time: c[0], inputPrice: c[4] })
      }
      return a
    }, [])
    formattedData[formattedData.length - 1].time = Date.now()
    setChartData(formattedData.filter((d: any) => d.price))
  }

  const getInputTokenInfo = async () => {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${inputTokenId}?localization=false&tickers=false&developer_data=false&sparkline=false
      `
    )
    const data = await response.json()
    setInputTokenInfo(data)
  }

  const getOutputTokenInfo = async () => {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${outputTokenId}?localization=false&tickers=false&developer_data=false&sparkline=false
      `
    )
    const data = await response.json()
    setOutputTokenInfo(data)
  }

  useMemo(() => {
    if (baseTokenId && quoteTokenId) {
      getChartData()
    }
  }, [daysToShow, baseTokenId, quoteTokenId])

  useMemo(() => {
    if (baseTokenId) {
      getInputTokenInfo()
    }
    if (quoteTokenId) {
      getOutputTokenInfo()
    }
  }, [baseTokenId, quoteTokenId])

  const chartChange = chartData.length
    ? ((chartData[chartData.length - 1]['price'] - chartData[0]['price']) /
        chartData[0]['price']) *
      100
    : 0

  return (
    <ContentBox>
      {chartData.length && baseTokenId && quoteTokenId ? (
        <div className="">
          <div className="flex items-start justify-between">
            <div>
              {inputTokenInfo && outputTokenInfo ? (
                <div className="text-sm text-th-fgd-3">
                  {`${outputTokenInfo?.symbol?.toUpperCase()}/${inputTokenInfo?.symbol?.toUpperCase()}`}
                </div>
              ) : null}
              {mouseData ? (
                <>
                  <div className="text-lg font-bold text-th-fgd-1">
                    {numberFormatter.format(mouseData['price'])}
                    <span
                      className={`ml-2 text-xs ${
                        chartChange >= 0 ? 'text-th-green' : 'text-th-red'
                      }`}
                    >
                      {chartChange.toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-xs font-normal text-th-fgd-3">
                    {dayjs(mouseData['time']).format('DD MMM YY, h:mma')}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg font-bold text-th-fgd-1">
                    {numberFormatter.format(
                      chartData[chartData.length - 1]['price']
                    )}
                    <span
                      className={`ml-2 text-xs ${
                        chartChange >= 0 ? 'text-th-green' : 'text-th-red'
                      }`}
                    >
                      {chartChange.toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-xs font-normal text-th-fgd-3">
                    {dayjs(chartData[chartData.length - 1]['time']).format(
                      'DD MMM YY, h:mma'
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end">
              <button
                className={`px-3 py-2 text-xs font-bold text-th-fgd-4 focus:outline-none md:hover:text-th-primary ${
                  daysToShow === 1 && 'text-th-primary'
                }`}
                onClick={() => setDaysToShow(1)}
              >
                24H
              </button>
              <button
                className={`px-3 py-2 text-xs font-bold text-th-fgd-4 focus:outline-none md:hover:text-th-primary ${
                  daysToShow === 7 && 'text-th-primary'
                }`}
                onClick={() => setDaysToShow(7)}
              >
                7D
              </button>
              <button
                className={`px-3 py-2 text-xs font-bold text-th-fgd-4 focus:outline-none md:hover:text-th-primary ${
                  daysToShow === 30 && 'text-th-primary'
                }`}
                onClick={() => setDaysToShow(30)}
              >
                30D
              </button>
            </div>
          </div>
          {!hideChart ? (
            <div className="mt-6 h-36" ref={observe}>
              <AreaChart
                width={width}
                height={height}
                data={chartData}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <Tooltip
                  cursor={{
                    strokeOpacity: 0,
                  }}
                  content={<></>}
                />
                {/* <defs>
                  <linearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffba24" stopOpacity={0.9} />
                    <stop offset="90%" stopColor="#ffba24" stopOpacity={0} />
                  </linearGradient>
                </defs> */}
                <Area
                  isAnimationActive={true}
                  type="monotone"
                  dataKey="price"
                  stroke="#ffba24"
                  fill="url(#gradientArea)"
                />
                <XAxis dataKey="time" hide />
                <YAxis
                  dataKey="price"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  hide
                />
              </AreaChart>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-md bg-th-bkg-3 p-4 text-center text-th-fgd-3 md:mt-0">
          <LineChartIcon className="mx-auto h-6 w-6 text-th-primary" />
          Chart not available
        </div>
      )}
    </ContentBox>
  )
}

export default SwapTokenChart
