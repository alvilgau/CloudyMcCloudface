module Graph exposing (viewGraph)

import Plot exposing (..)
import Svg.Attributes exposing (stroke)
import Date
import Time


viewGraph keywords data =
    let
        plotCustomizations_ =
            { defaultSeriesPlotCustomizations | horizontalAxis = timeAxis }
    in
        viewSeriesCustom
            plotCustomizations_
            (List.map (\k -> lineColoredWhereKeyword k.name k.color) keywords)
            data


lineColoredWhereKeyword name colors =
    { axis = sometimesYouDoNotHaveAnAxis
    , interpolation = Monotone Nothing [ stroke colors ]
    , toDataPoints = List.filter (\dp -> dp.keyword == name) >> List.map (\dp -> clear dp.time dp.value)
    }


timeAxis : Axis
timeAxis =
    customAxis <|
        \summary ->
            { position = closestToZero
            , axisLine = Just (simpleLine summary)
            , ticks = List.map simpleTick (decentPositions summary)
            , labels = List.map timeLabel (decentPositions summary)
            , flipAnchor = False
            }


timeLabel : Time.Time -> LabelCustomizations
timeLabel position =
    { position = position
    , view = viewLabel [] (Date.fromTime position |> dateToTimeString)
    }


dateToTimeString : Date.Date -> String
dateToTimeString date =
    let
        hour =
            Date.hour date
                |> toString

        minute =
            Date.minute date
                |> toString
                |> String.padLeft 2 '0'

        second =
            Date.second date
                |> toString
                |> String.padLeft 2 '0'
    in
        hour ++ ":" ++ minute ++ ":" ++ second
