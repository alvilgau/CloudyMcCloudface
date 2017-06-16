module RecordingForm exposing (..)

import Time exposing (Time)
import Recording exposing (Recording, Field)
import Html exposing (Html, form, button, label, input, span, text, div, h2)
import Html.Attributes exposing (type_, class, for, id, style)
import Html.Events exposing (onClick, onCheck, onInput)
import Regex exposing (regex, HowMany(..))
import CreateRecordingPageModel exposing (CreateRecordingPageModel)
import DateTimePicker
import DateTimePicker.Css
import Css


view : CreateRecordingPageModel -> Html CreateRecordingPageModel.Msg
view model =
    let
        { css } =
            Css.compile [ DateTimePicker.Css.css ]
    in
        form [ class "u-full-width" ]
            (List.concat
                [ [ Html.node "style" [] [ text css ] ]
                , labeledInput (datePicker model.beginState model.beginValue CreateRecordingPageModel.Begin) "Start"
                , labeledInput (datePicker model.endState model.endValue CreateRecordingPageModel.End) "End"
                , labeledInput (keywordInput (String.join ", " model.keywords)) "Keywords"
                , [ button
                        [ class "button-primary", style [ ( "width", "33%" ) ], type_ "button", onClick CreateRecordingPageModel.Submit ]
                        [ text "Submit" ]
                  ]
                ]
            )


labeledInput : (String -> Html CreateRecordingPageModel.Msg) -> String -> List (Html CreateRecordingPageModel.Msg)
labeledInput inputHtml labelString =
    let
        inputId =
            labelString
                |> String.toLower
                |> Regex.replace All (regex " ") (\_ -> "-")
                |> Regex.replace All (regex "[^a-z0-9]") (\_ -> "")
    in
        [ label [ for inputId ] [ text labelString ]
        , inputHtml inputId
        ]


keywordInput content id_ =
    input [ type_ "text", class "u-full-width", onInput ((String.split "," >> (List.map String.trim) >> CreateRecordingPageModel.KeywordsEdited)), id id_ ] [ text content ]


datePicker state value msgType id_ =
    DateTimePicker.dateTimePicker
        (CreateRecordingPageModel.DateTimeChanged msgType)
        [ id id_, type_ "text", class "u-full-width" ]
        state
        value
