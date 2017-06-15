module RecordingForm exposing (..)

import Time exposing (Time)
import Recording exposing (Recording, Field)
import Html exposing (Html, form, button, label, input, span, text, div, h2)
import Html.Attributes exposing (type_, class, for, id, style)
import Html.Events exposing (onClick, onCheck, onInput)
import Regex exposing (regex, HowMany(..))
import Msg exposing (..)


view : Recording -> List (Html Msg)
view recording =
    []



--     [ h2 [] [ text "Set up new taping" ]
--     , form [ class "u-full-width" ]
--         (List.concat
--             [ labeledInput (String.toFloat >> Result.withDefault 0 >> Recording.Begin) "time" "Begin" (toString recording.begin)
--             , labeledInput (String.toFloat >> Result.withDefault 0 >> Recording.End) "time" "End" (toString recording.begin)
--             , labeledInput (String.split "," >> (List.map String.trim) >> Recording.Keywords) "text" "Keywords" (String.join ", " recording.keywords)
--             , [ button
--                     [ class "button-primary", style [ ( "width", "33%" ) ], type_ "button" ]
--                     [ text "Submit" ]
--               , button
--                     [ class "button", style [ ( "width", "33%" ), ( "float", "right" ) ], type_ "button" ]
--                     [ text "Cancel" ]
--               ]
--             ]
--         )
--     ]
-- labeledInput : (String -> Field) -> String -> String -> String -> List (Html.Html Msg)
-- labeledInput fieldf inputType labelString content =
--     let
--         inputId =
--             labelString
--                 |> String.toLower
--                 |> Regex.replace All (regex " ") (\_ -> "-")
--                 |> Regex.replace All (regex "[^a-z0-9]") (\_ -> "")
--     in
--         [ label [ for inputId ] [ text labelString ]
--         , input [ type_ "text", class "u-full-width", onInput (fieldf >> RecordingEdited), id inputId ] [ text content ]
--         ]
