module TapeTable exposing (view)

import Html exposing (Html, text, tr, td, table, th, thead, tbody)
import Html.Attributes exposing (class)
import Html.Events exposing (onClick)
import Msg exposing (..)
import Recording exposing (Recording)
import Date
import Date.Format exposing (format)


view : List Recording -> Html Msg
view recordings =
    table [ class "u-full-width" ] [ header, rows recordings ]


header : Html msg
header =
    thead []
        [ tr [] (List.map (\heading -> th [] [ text heading ]) [ "Start", "End", "Keywords" ]) ]


rows : List Recording -> Html Msg
rows recordings =
    tbody [] <| List.map row recordings


row : Recording -> Html Msg
row recording =
    let
        keywords =
            String.join ", " recording.keywords

        columnContent =
            [ formatDateHtml recording.begin, formatDateHtml recording.end, text keywords ]
    in
        tr [ onClick <| SelectRecording recording ]
            (List.map (\content -> td [] [ content ]) columnContent)

formatDateHtml : Date.Date -> Html msg
formatDateHtml =
    formatDate >> text


formatDate : Date.Date -> String
formatDate date =
    format "%Y/%m/%d %H:%M:%S" date
