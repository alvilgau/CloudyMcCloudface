module RecordingForm exposing (..)

import Html exposing (Html, form, button, label, input, text)
import Html.Attributes exposing (type_, class, for, id, style)
import Html.Events exposing (onClick, onInput)
import Regex exposing (regex, HowMany(..))
import CreateRecordingPageModel exposing (CreateRecordingPageModel, Msg(..), DTPicker(..))
import DateTimePicker
import DateTimePicker.Css
import Css
import Date


view : CreateRecordingPageModel -> Html CreateRecordingPageModel.Msg
view model =
    let
        { css } =
            Css.compile [ DateTimePicker.Css.css ]
    in
        form [ class "u-full-width" ]
            (List.concat
                [ [ Html.node "style" [] [ text css ] ]
                , labeledInput (datePicker model.beginState model.beginValue Begin) "Start"
                , labeledInput (datePicker model.endState model.endValue End) "End"
                , labeledInput (keywordInput (String.join ", " model.keywords)) "Keywords"
                , [ button
                        [ class "button-primary", style [ ( "width", "33%" ) ], type_ "button", onClick Submit ]
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


keywordInput : String -> String -> Html Msg
keywordInput content id_ =
    input
        [ type_ "text"
        , class "u-full-width"
        , onInput ((String.split "," >> (List.map String.trim) >> CreateRecordingPageModel.KeywordsEdited))
        , id id_
        ]
        [ text content ]


datePicker : DateTimePicker.State -> Maybe Date.Date -> DTPicker -> String -> Html Msg
datePicker state value msgType id_ =
    DateTimePicker.dateTimePicker
        (CreateRecordingPageModel.DateTimeChanged msgType)
        [ id id_, type_ "text", class "u-full-width" ]
        state
        value
