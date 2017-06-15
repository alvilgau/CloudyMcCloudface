module View exposing (view)

-- import TenantForm

import Html exposing (div, Html, program, button, text, span, node, tr, td, table, th, thead, tbody, h1, h2, input, b, label, form, section)
import Html.Attributes exposing (style, rel, href, type_, class, placeholder, for, id)
import Html.Events exposing (onClick, onInput)
import Msg exposing (..)
import Model exposing (..)
import Tenant
import TenantForm
import Maybe.Extra as Maybe
import KeywordTable
import Graph
import TapeTable
import Recording exposing (Recording)
import RecordingForm


view : Model -> Html Msg
view model =
    if not (Tenant.isSelected model.tenant) then
        container False model <| TenantForm.view model.tenant
    else
        case model.modus of
            Nothing ->
                container True model <| [ liveTapeSelect model ]

            Just Tape ->
                model.editedRecording
                    |> Maybe.map (\recording -> tapeStartView recording)
                    |> Maybe.orElse (Maybe.map (\_ -> tapeResultView model) model.selectedRecording)
                    |> Maybe.withDefault (tapeTableView model)
                    |> container True model

            Just Live ->
                container True model <| liveView model


liveTapeSelect model =
    div [ class "twelve columns", style [ ( "margin-top", "20rem" ) ] ]
        [ liveTapeButton "Live" Live "left"
        , liveTapeButton "Tape" Tape "right"
        ]


liveView model =
    [ div [ class "nine columns" ] [ Graph.view model.keywords model.data ]
    , div [ class "three columns" ] [ KeywordTable.view False model.editedKeyword model.keywords ]
    ]


tapeTableView : Model -> List (Html Msg)
tapeTableView model =
    [ div [ class "ten columns" ] [ h2 [] [ text "Tapings" ] ]
    , div [ class "two columns" ] [ button [ class "button-primary", style [ ( "padding", "0 15px" ) ], onClick CreateNewRecording ] [ b [] [ text "+" ] ] ]
    , div [ class "twelve columns" ] [ tapeTable model.recordings ]
    ]


tapeTable maybeRecs =
    case maybeRecs of
        Just recs ->
            TapeTable.view recs

        Nothing ->
            span [] [ text "You haven't taped anything yet!" ]


tapeStartView : Recording -> List (Html Msg)
tapeStartView recording =
    [ div [ class "twelve columns" ] [ h2 [] [ text "Start New Taping" ] ]
    , div [ class "twelve columns" ] (RecordingForm.view recording)
    ]



--  [ div [ class "twelve columns" ]
--         [ h2 [] [ text "Twitter Credentials" ]
--         , form [ class "u-full-width" ]
--             (List.concat
--                 [ labeledTenantInput Tenant.ConsumerKey "Consumer Key" fields.consumerKey
--                 , labeledTenantInput Tenant.ConsumerSecret "Consumer Secret" fields.consumerSecret
--                 , labeledTenantInput Tenant.Token "Token" fields.token
--                 , labeledTenantInput Tenant.TokenSecret "Token Secret" fields.tokenSecret
--                 , [ button
--                         [ class "button-primary", style [ ( "width", "33%" ) ], type_ "button", onClick <| TenantSelected <| Tenant.custom tenant ]
--                         [ text "Submit" ]
--                   , button
--                         [ class "button", style [ ( "width", "33%" ), ( "float", "right" ) ], type_ "button", onClick <| TenantSelected <| Tenant.default tenant ]
--                         [ text "Skip" ]
--                   ]
--                 ]
--             )
--         ]


tapeResultView model =
    [ div [ class "ten columns" ] [ Graph.view model.keywords model.data ]
    , div [ class "two columns" ] [ KeywordTable.view True model.editedKeyword model.keywords ]
    ]


liveTapeButton text modus leftRight =
    button
        [ style
            [ ( "width", "33%" )
            , ( "height", "10rem" )
            , ( "margin", "1rem 5rem" )
            , ( "float", leftRight )
            , ( "font-size", "2.4rem" )
            ]
        , onClick <| SelectModus modus
        ]
        [ Html.text text ]


container collapseHeader model content =
    div [ class "container" ]
        [ node "link" [ rel "stylesheet", type_ "text/css", href "css/normalize.css" ] []
        , node "link" [ rel "stylesheet", type_ "text/css", href "css/skeleton.css" ] []
        , section
            [ style
                [ ( "padding-top"
                  , if collapseHeader then
                        "2rem"
                    else
                        "10rem"
                  )
                , ( "padding-bottom", "1rem" )
                , ( "margin-bottom", "5rem" )
                , ( "background-color", "#3d3d3d" )
                , ( "color", "white" )
                ]
            ]
            [ h1 [ style [ ( "text-align", "center" ) ] ] [ text "Twitter Sentiment Analysis" ]
            ]
        , errorDiv model.error
        , tapeLiveDiv model.tenant model.modus
        , div [ class "row" ] content
        ]


tapeLiveDiv tenant modus =
    if Tenant.isSelected tenant && Maybe.isJust modus then
        div [ class "row", style [ ( "padding", "1rem" ) ] ]
            [ div [ class "twelve columns" ]
                [ button
                    [ class "button", style [ ( "width", "33%" ) ], type_ "button", onClick (SelectModus Live) ]
                    [ text "Live" ]
                , button
                    [ class "button", style [ ( "width", "33%" ), ( "float", "right" ) ], type_ "button", onClick (SelectModus Tape) ]
                    [ text "Tape" ]
                ]
            ]
    else
        text ""


errorDiv error =
    case error of
        Just msg ->
            div
                [ class "row"
                , onClick HideError
                , style
                    [ ( "background-color", "rgba(239, 114, 58, 0.61)" )
                    , ( "text-align", "center" )
                    , ( "font-size", "2.4rem" )
                    , ( "padding", "1rem" )
                    , ( "margin-bottom", "4rem" )
                    ]
                ]
                [ div [ class "twelve columns" ] [ text msg ] ]

        Nothing ->
            text ""
