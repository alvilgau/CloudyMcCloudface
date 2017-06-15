module TapeTable exposing (view)

import Html exposing (div, Html, program, button, text, span, node, tr, td, table, th, thead, tbody, h1, input, b, label, form, section)
import Html.Attributes exposing (style, rel, href, type_, class, placeholder, for, id)
import Html.Events exposing (onClick, onInput, onCheck)
import Msg exposing (..)
import Recording exposing (Recording)
import Date
import Date.Format exposing (format)


view recordings =
    table [ class "u-full-width" ] [ header, rows recordings ]


header : Html msg
header =
    thead []
        [ tr []
            ([ "Start", "End", "Keywords" ]
                |> List.map (\heading -> th [] [ text heading ])
            )
        ]


rows : List Recording -> Html Msg
rows recordings =
    tbody [] <| List.map row recordings


row : Recording -> Html Msg
row recording =
    let
        keywords =
            String.join ", " recording.keywords

        columnContent =
            [ text <| formatDate recording.begin, text <| formatDate recording.end, text keywords ]
    in
        tr [ onClick <| SelectRecording recording ]
            (List.map (\content -> td [] [ content ]) columnContent)


formatDate date =
    format "%Y/%m/%d %H:%M:%S" date
