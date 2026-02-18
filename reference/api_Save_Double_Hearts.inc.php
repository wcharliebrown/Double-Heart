<?php
/**
 * 
 * This script will run whenever the page api-Save-Double-Hearts is accessed.
 *
 * To modify the page fields use $this->db_page_row like this:
 * $this->db_page_row['body'] .= " Hey this is in the body field now!<br />";
 *
 * To replace a token in the page, use curly braces in the page body(or whatever) like this:
 * In the page: ...<input type="text" name="first_name" value="{first_name}">...
 * In this script: $this->db_page_row['body'] = str_replace('{first_name}',$first_name,$this->db_page_row['body']);
 * @var page $this
*/
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS, DELETE, PUT');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: x-requested-with, X-PINGOTHER, Content-Type, origin, Authorization, accept, client-security-token');
$php_obj = new stdClass;
$php_obj->success = false;
$php_obj->notes = "";
$php_obj->black_heart = false;

try {
    // Add check for authorization header
    // "Authorization": "Bearer f0f8b5a8081769bef0b0b2ce89ddc7e1fab032e212f5fa4555f66186afaa9aab"

    $headers = getallheaders();
    if(!isset($headers['Authorization'])) {
        throw new Exception("Missing authorization header",__LINE__);
    }
    $authorization_array = explode(' ', $headers['Authorization']);
    if(count($authorization_array) != 2) {
        throw new Exception("Invalid authorization header",__LINE__);
    }
    if($authorization_array[0] != 'Bearer') {
        throw new Exception("Invalid authorization header",__LINE__);
    }
    $authorization_token = $authorization_array[1];
    $sql_1 = "SELECT * FROM C_token
        WHERE item_name = '" . $this->real_escape_string($authorization_token) . "' 
        AND item_active=1
        ";
    $C_token_row = $this->getOneRowSQL($sql_1);
    if(!$C_token_row) {
        throw new Exception("Invalid authorization token",__LINE__);
    }
    $user_id = $C_token_row['KD_user_item_id'];
    $user_row = $this->getOneRowSQL("SELECT * FROM KD_user WHERE item_id = '" . (int)$user_id . "' AND item_active=1");
    if(!$user_row) {
        throw new Exception("Invalid user id",__LINE__);
    }
    $_SESSION['_user_id'] = $user_row['item_id'];
    $this->db_user_row = $user_row;


    if(!$_POST || !is_array($_POST)) {
        $json = file_get_contents('php://input');
        $_POST = json_decode($json, true);
    }
    if(!$_POST || !is_array($_POST)) {
        throw new Exception("Missing parameters",__LINE__);
    }
    $propertyId = (int)$_POST['propertyId'];
    if(!$propertyId) {
        throw new Exception("Invalid propertyId",__LINE__);
    }
    $notes = $_POST['notes'];
    $url = $_POST['url'];
    $black_heart_yn = !empty($_POST['black_heart']) ? 'Y' : 'N';
    $sql_1 = "SELECT C_Double_Heart.*
        FROM C_Double_Heart

        LEFT JOIN C_Heart_Group_C_Double_Heart_join
        ON C_Heart_Group_C_Double_Heart_join.C_Double_Heart_item_id = C_Double_Heart.item_id
        AND C_Heart_Group_C_Double_Heart_join.item_active = 1

        LEFT JOIN C_Heart_Group_KD_user_join
        ON C_Heart_Group_KD_user_join.C_Heart_Group_item_id = C_Heart_Group_C_Double_Heart_join.C_Heart_Group_item_id
        AND C_Heart_Group_KD_user_join.item_active = 1


        WHERE C_Double_Heart.item_name = '" . (int)$propertyId . "'
        AND C_Double_Heart.item_active=1
        AND (
            C_Double_Heart.KD_user_item_id = '" . (int)$user_row['item_id'] . "'
            OR C_Heart_Group_KD_user_join.KD_user_item_id = '" . (int)$user_row['item_id'] . "'
        )
    ";
    $existing_row = $this->getOneRowSQL($sql_1);
    $this->log_message("sql_1: " . $sql_1);
    if($existing_row) {
        $sql = "UPDATE C_Double_Heart
            SET custom_notes = '" . $this->real_escape_string($notes) . "'
            ,url = '" . $this->real_escape_string($url) . "'
            ,Black_Heart_yn = '" . $this->real_escape_string($black_heart_yn) . "'
            WHERE item_id = '" . (int)$existing_row['item_id'] . "'";
        $item_id = $existing_row['item_id'];
        $this->log_message("sql: " . $sql);
        $result = $this->query($sql);
        if(!$result) {
            throw new Exception("Failed to save double heart",__LINE__);
        }

    } else {
        $sql = "INSERT INTO C_Double_Heart
            SET item_name = '" . (int)$propertyId . "'
            , custom_notes = '" . $this->real_escape_string($notes) . "'
            ,url = '" . $this->real_escape_string($url) . "'
            ,KD_user_item_id = '" . (int)$user_row['item_id'] . "'
            ,Black_Heart_yn = '" . $this->real_escape_string($black_heart_yn) . "'
            " . $this->usual_fields('C_Double_Heart');

        $this->log_message("sql: " . $sql);
        $result = $this->query($sql);
        if(!$result) {
            throw new Exception("Failed to save double heart",__LINE__);
        }
        $item_id = $this->insert_id();
    
        $sql_3 = "SELECT * FROM C_Heart_Group_KD_user_join WHERE KD_user_item_id='" . (int)$this->db_user_row['item_id'] . "'";
        $result_3 = $this->query($sql_3);
        while($row_3 = $this->fetchAssoc($result_3)) {
            $sql_4 = "INSERT INTO C_Heart_Group_C_Double_Heart_join
                SET C_Double_Heart_item_id='" . (int)$item_id . "'
                    ,C_Heart_Group_item_id='" . (int)$row_3['C_Heart_Group_item_id'] . "'
                    " . $this->usual_fields('C_Heart_Group_C_Double_Heart_join');
            $this->query($sql_4);
        }
    }

    

    $php_obj->success = true;
} catch(Exception $e) {
    $php_obj->success = false;
    $php_obj->error_msg = $e->getMessage();
}
header('Content-Type: application/json');
$json = json_encode($php_obj);
echo $json;
exit();