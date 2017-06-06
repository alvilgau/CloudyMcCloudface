module Main exposing (..)

import Graph exposing (viewGraph)
import Html exposing (div, Html, program, button, text, span, node, tr, td, table, th, thead, tbody, h1, input, b)
import Html.Attributes exposing (style, rel, href, type_, class, placeholder)
import Html.Events exposing (onClick, onInput)
import TestData
import Keyword exposing (Keyword)
import DataPoint exposing (DataPoint)
import WebSocket
import Communication exposing (InMessage(..))
import Svg
import Svg.Attributes as SvgAttr


main : Program Never Model Msg
main =
    program { init = init, update = update, subscriptions = subscriptions, view = view }


type alias Model =
    { keywords : List Keyword
    , data : List DataPoint
    , editedKeyword : String
    }


type Msg
    = NoOp
    | WSMessage String
    | Query
    | Remove String
    | Add String
    | KeywordEdited String


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NoOp ->
            model ! []

        WSMessage data ->
            webSocketReceived data model
                ! []

        Query ->
            model ! [ queryKeywordsCmd model ]

        Remove name ->
            let
                keywords =
                    List.filter (\k -> k.name /= name) model.keywords
                        |> keywordsWithColor

                data =
                    List.filter (\dp -> dp.keyword /= name) model.data

                model_ =
                    { model | keywords = keywords, data = data }
            in
                model_ ! [ queryKeywordsCmd model_ ]

        Add name ->
            let
                keywords =
                    List.append model.keywords [ Keyword name "" ]
                        |> keywordsWithColor

                model_ =
                    { model | keywords = keywords, editedKeyword = "" }
            in
                model_ ! [ queryKeywordsCmd model_ ]

        KeywordEdited keyword ->
            { model | editedKeyword = keyword } ! []


subscriptions : Model -> Sub Msg
subscriptions model =
    WebSocket.listen "ws://localhost:3000" WSMessage


queryKeywordsCmd model =
    let
        keywordNames =
            List.map .name model.keywords
    in
        Communication.queryKeywordsCmd Nothing keywordNames


colors =
    [ "rgb(57,106,177)", "rgb(218,124,48)", "rgb(62,150,81)", "rgb(204,37,41)", "rgb(83,81,84)" ]


view : Model -> Html Msg
view model =
    div [ class "container" ]
        [ node "link" [ rel "stylesheet", type_ "text/css", href "css/normalize.css" ] []
        , node "link" [ rel "stylesheet", type_ "text/css", href "css/skeleton.css" ] []
        , h1 [] [ text "Twitter Sentiment Analysis" ]
        , div [ class "row" ] [ viewGraph model.keywords model.data ]
        , div [ class "row" ] [ table [ style [] ] [ keywordHeading, (keywordRows model.keywords model.editedKeyword) ] ]
        ]


keywordsWithColor keywords =
    keywords
        |> List.map .name
        |> List.map2 (\c k -> { name = k, color = c }) colors


keywordHeading =
    thead []
        [ tr []
            [ th [] [ text "Keyword" ]
            , th [] [ text "Color" ]
            , th [] [ text "Action" ]
            ]
        ]


keywordRows keywords editedKeyword =
    let
        rows =
            (List.map keywordRow keywords)
                ++ [ inputRow editedKeyword ]
                |> List.take 5
    in
        tbody [] rows


keywordRow keyword =
    tr []
        [ td [] [ text keyword.name ]
        , td [] [ coloredCircle keyword.color ]
        , td [] [ button [ style [ ( "padding", "0 15px" ) ], onClick (Remove keyword.name) ] [ text "x" ] ]
        ]


inputRow editedKeyword =
    tr []
        [ td [] [ input [ placeholder "New keyword", onInput KeywordEdited ] [] ]
        , td [] [ coloredCircle "rgba(0,0,0,0)" ]
        , td [] [ button [ class "button-primary", style [ ( "padding", "0 15px" ) ], onClick (Add editedKeyword) ] [ b [] [ text "+" ] ] ]
        ]


coloredCircle color =
    Svg.svg [ SvgAttr.width "20", SvgAttr.height "20" ] [ Svg.circle [ SvgAttr.cx "10", SvgAttr.cy "10", SvgAttr.r "10", SvgAttr.fill color ] [] ]


webSocketReceived data model =
    case (Communication.handleMessage data) of
        Data data ->
            { model | data = (data :: model.data) }

        Invalid error ->
            model


init : ( Model, Cmd Msg )
init =
    { keywords = [], data = [], editedKeyword = "" } ! []



-- { keywords = keywordsWithColor TestData.keywords, data = TestData.data, editedKeyword = "" } ! []
