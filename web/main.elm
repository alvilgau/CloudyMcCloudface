module Main exposing (..)

import Graph exposing (viewGraph)
import Html exposing (div, Html, program, button, text, span, node, tr, td, table, th, thead, tbody, h1, input, b, label, form)
import Html.Attributes exposing (style, rel, href, type_, class, placeholder, for, id)
import Html.Events exposing (onClick, onInput, onCheck)
import Keyword exposing (Keyword)
import DataPoint exposing (DataPoint)
import WebSocket
import Communication exposing (InMessage(..))
import Svg
import Svg.Attributes as SvgAttr
import Regex exposing (regex, HowMany(..))
import Tenant exposing (Tenant)


main : Program Never Model Msg
main =
    program { init = init, update = update, subscriptions = subscriptions, view = view }


type alias Model =
    { keywords : List Keyword
    , data : List DataPoint
    , editedKeyword : String
    , tenant : Tenant
    }


type Msg
    = NoOp
    | WSMessage String
    | Query
    | Remove String
    | Add String
    | KeywordEdited String
    | TenantEdited Tenant.TenantField String
    | TenantSelected Bool


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

        TenantEdited fieldId value ->
            let
                tenant =
                    Tenant.set fieldId value model.tenant
            in
                { model | tenant = tenant } ! []

        TenantSelected useCustom ->
            let
                ( tenant, cmd ) =
                    if useCustom then
                        ( Tenant.custom model.tenant, Cmd.none )
                    else
                        ( Tenant.default model.tenant, queryKeywordsCmd model )
            in
                ( { model | tenant = tenant }, cmd )


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
    div [ class "container", style [ ( "max-width", "1440px" ) ] ]
        [ node "link" [ rel "stylesheet", type_ "text/css", href "css/normalize.css" ] []
        , node "link" [ rel "stylesheet", type_ "text/css", href "css/skeleton.css" ] []
        , h1 [] [ text "Twitter Sentiment Analysis" ]
        , div [ class "row" ]
            [ div [ class "eight columns" ] [ viewGraph model.keywords model.data ]
            , div [ class "four columns" ] <| tenantSelector model.tenant
            , div [ class "four columns" ] [ table [ class "u-full-width" ] [ keywordHeading, (keywordRows model.keywords model.editedKeyword) ] ]
            ]
        ]


tenantSelector tenant =
    [ label []
        [ input [ type_ "checkbox", onCheck TenantSelected ] []
        , span [ class "label-body" ] [ text "Use own Twitter" ]
        ]
    , case Tenant.get tenant of
        Just custom ->
            form [ class "u-full-width" ]
                (List.concat
                    [ labeledTenantInput Tenant.ConsumerKey "Consumer Key" custom.consumerKey
                    , labeledTenantInput Tenant.Token "Token" custom.token
                    , labeledTenantInput Tenant.ConsumerSecret "Consumer Secret" custom.consumerSecret
                    , labeledTenantInput Tenant.TokenSecret "Token Secret" custom.tokenSecret
                    , [ button [ class "button-primary", type_ "button", onClick Query ] [ text "Reconnect" ]
                      ]
                    ]
                )

        Nothing ->
            text ""
    ]


labeledTenantInput fieldId labelString content =
    let
        inputId =
            labelString
                |> String.toLower
                |> Regex.replace All (regex " ") (\_ -> "-")
                |> Regex.replace All (regex "[^a-z0-9]") (\_ -> "")
    in
        [ label [ for inputId ] [ text labelString ]
        , input [ type_ "text", class "u-full-width", onInput (TenantEdited fieldId), id inputId ] [ text content ]
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
        [ td [] [ input [ type_ "text", placeholder "New keyword", onInput KeywordEdited ] [] ]
        , td [] [ coloredCircle "rgba(0,0,0,0)" ]
        , td [] [ button [ type_ "submit", class "button-primary", style [ ( "padding", "0 15px" ) ], onClick (Add editedKeyword) ] [ b [] [ text "+" ] ] ]
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
    { keywords = [], data = [], editedKeyword = "", tenant = Tenant.init } ! []
